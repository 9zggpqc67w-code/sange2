import { ApiError, GoogleGenAI, type GenerateContentResponse, type Part } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Raised when no GEMINI_API_KEY is configured. Callers fail gracefully and can be retried. */
export class LlmUnavailableError extends Error {
  constructor() {
    super('GEMINI_API_KEY is not configured; LLM-backed processing is unavailable');
    this.name = 'LlmUnavailableError';
  }
}

/** The model declined, was cut off, the request failed, or the reply is not valid JSON. */
export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmOutputError';
  }
}

/** Provider-neutral user content: callers never see which API carries it. */
export type LlmContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } };

export interface JsonCompletionRequest {
  system: string;
  /** User content: text, image and PDF document blocks. */
  content: LlmContentBlock[];
  /** JSON Schema the response is constrained to (structured outputs). */
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** Accepted for interface stability; the model's own default reasoning is used. */
  effort?: 'low' | 'medium' | 'high';
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_MAX_OUTPUT_TOKENS = 3000;
const REQUEST_TIMEOUT_MS = 120_000;

/** Finish reasons where the model refused or the content was blocked. */
const BLOCKED = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY', 'LANGUAGE']);

function toPart(block: LlmContentBlock): Part {
  if (block.type === 'text') return { text: block.text };
  // images and PDFs are sent inline as base64
  return { inlineData: { mimeType: block.source.media_type, data: block.source.data } };
}

/**
 * Schema-constrained JSON completion through the official Google Gemini API (@google/genai).
 * Everything LLM-related goes through `completeJson`, so document extraction and the agent do
 * not know which provider carries the request, and tests replace this one provider. The model is
 * never given a score or a decision to make here - only text to read and a schema to fill.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private client?: GoogleGenAI;
  /** Delay before the single retry of a transient failure (429 / 5xx / network); tests set it to 0. */
  protected retryDelayMs = 1000;

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('GEMINI_API_KEY') ||
      process.env['Gemini API Key'] ||
      process.env.GOOGLE_API_KEY,
    );
  }

  get model(): string {
    return this.config.get<string>('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;
  }

  private getClient(): GoogleGenAI {
    const apiKey =
      this.config.get<string>('GEMINI_API_KEY') ||
      process.env['Gemini API Key'] ||
      process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new LlmUnavailableError();
    this.client ??= new GoogleGenAI({ apiKey });
    return this.client;
  }

  async completeJson(req: JsonCompletionRequest): Promise<unknown> {
    const client = this.getClient();

    const response = await this.generate(client, req);

    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) throw new LlmOutputError('The model declined to process this content');
    const finish = response.candidates?.[0]?.finishReason as string | undefined;
    if (finish && BLOCKED.has(finish)) throw new LlmOutputError('The model declined to process this content');
    if (finish === 'MAX_TOKENS') throw new LlmOutputError('The model output was truncated');

    const text = (response.text ?? '').trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
    try {
      return JSON.parse(text);
    } catch {
      this.logger.warn(`Non-JSON model output (${text.slice(0, 120)}...)`);
      throw new LlmOutputError('The model did not return valid JSON');
    }
  }

  /** One generateContent call with a timeout and one retry for transient failures. Never leaks the API key. */
  private async generate(client: GoogleGenAI, req: JsonCompletionRequest, attempt = 1): Promise<GenerateContentResponse> {
    try {
      return await client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: req.content.map(toPart) }],
        config: {
          systemInstruction: req.system,
          responseMimeType: 'application/json',
          responseJsonSchema: req.schema,
          maxOutputTokens: req.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          httpOptions: { timeout: REQUEST_TIMEOUT_MS },
        },
      });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const transient = status === 0 || status === 429 || status >= 500;
      if (attempt === 1 && transient) {
        await new Promise((r) => setTimeout(r, this.retryDelayMs));
        return this.generate(client, req, 2);
      }
      throw new LlmOutputError(
        status
          ? `LLM request failed (HTTP ${status}): ${this.describe(err)}`
          : `LLM request failed: ${err instanceof Error ? err.name : 'network error'}`,
      );
    }
  }

  /** The provider's message, without anything that could contain the key. */
  private describe(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    // the SDK often embeds the JSON error body in the message; surface its "message" field
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed.error?.message) return parsed.error.message;
    } catch {
      /* not JSON */
    }
    return raw.length > 300 ? `${raw.slice(0, 300)}...` : raw;
  }
}
