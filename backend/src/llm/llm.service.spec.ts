import type { ConfigService } from '@nestjs/config';

// Only the client is replaced; the SDK's real ApiError class is kept so error handling is exercised for real.
const generateContent = jest.fn();
const GoogleGenAI = jest.fn().mockImplementation(() => ({ models: { generateContent } }));
jest.mock('@google/genai', () => ({ ...jest.requireActual('@google/genai'), GoogleGenAI }));

import { ApiError } from '@google/genai';
import { LlmOutputError, LlmService, LlmUnavailableError, type JsonCompletionRequest } from './llm.service';

const config = (env: Record<string, string | undefined>) => ({ get: (k: string) => env[k] }) as unknown as ConfigService;

/** The retry delay is zero in tests. */
class TestLlm extends LlmService {
  constructor(c: ConfigService) {
    super(c);
    this.retryDelayMs = 0;
  }
}
const KEY = 'AIza-test-key-123';
const make = (env: Record<string, string | undefined> = { GEMINI_API_KEY: KEY }) => new TestLlm(config(env));

const req: JsonCompletionRequest = { system: 'sys', content: [{ type: 'text', text: 'hi' }], schema: { type: 'object' } };
const reply = (text: unknown, finishReason = 'STOP', promptFeedback?: unknown) => ({
  text,
  candidates: [{ finishReason }],
  promptFeedback,
});
const apiError = (status: number, message: string) => new ApiError({ status, message: JSON.stringify({ error: { code: status, message } }) });

beforeEach(() => {
  generateContent.mockReset();
  GoogleGenAI.mockClear();
});

describe('LlmService (Gemini)', () => {
  describe('request construction', () => {
    it('initialises the SDK with the API key and defaults to gemini-3.5-flash-lite', async () => {
      generateContent.mockResolvedValue(reply('{"a":1}'));
      const llm = make();
      expect(llm.model).toBe('gemini-3.5-flash-lite');
      await llm.completeJson(req);
      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: KEY });
      expect(generateContent.mock.calls[0][0].model).toBe('gemini-3.5-flash-lite');
    });

    it('honours GEMINI_MODEL', async () => {
      generateContent.mockResolvedValue(reply('{}'));
      await make({ GEMINI_API_KEY: KEY, GEMINI_MODEL: 'gemini-2.5-flash' }).completeJson(req);
      expect(generateContent.mock.calls[0][0].model).toBe('gemini-2.5-flash');
    });

    it('creates the client once and reuses it', async () => {
      generateContent.mockResolvedValue(reply('{}'));
      const llm = make();
      await llm.completeJson(req);
      await llm.completeJson(req);
      expect(GoogleGenAI).toHaveBeenCalledTimes(1);
    });

    it('asks for schema-constrained JSON with the system prompt and the output-token limit', async () => {
      generateContent.mockResolvedValue(reply('{}'));
      await make().completeJson({ ...req, schema: { type: 'object', required: ['x'] }, maxTokens: 777 });
      const arg = generateContent.mock.calls[0][0];
      expect(arg.contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
      expect(arg.config).toMatchObject({
        systemInstruction: 'sys',
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object', required: ['x'] },
        maxOutputTokens: 777,
      });
      expect(arg.config.httpOptions.timeout).toBeGreaterThan(0);
    });

    it('uses a 3000-token output limit when the caller gives none', async () => {
      generateContent.mockResolvedValue(reply('{}'));
      await make().completeJson(req);
      expect(generateContent.mock.calls[0][0].config.maxOutputTokens).toBe(3000);
    });

    it('sends images and PDFs inline as base64 parts', async () => {
      generateContent.mockResolvedValue(reply('{}'));
      await make().completeJson({
        ...req,
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'BBBB' } },
          { type: 'text', text: 'read it' },
        ],
      });
      expect(generateContent.mock.calls[0][0].contents[0].parts).toEqual([
        { inlineData: { mimeType: 'image/png', data: 'AAAA' } },
        { inlineData: { mimeType: 'application/pdf', data: 'BBBB' } },
        { text: 'read it' },
      ]);
    });
  });

  describe('responses', () => {
    it('parses structured JSON exactly as returned', async () => {
      generateContent.mockResolvedValue(reply('{"documentType":"CV","claims":[{"fieldKey":"applicant.name","entryKey":null}]}'));
      await expect(make().completeJson(req)).resolves.toEqual({ documentType: 'CV', claims: [{ fieldKey: 'applicant.name', entryKey: null }] });
    });

    it('tolerates a JSON code fence around the reply', async () => {
      generateContent.mockResolvedValue(reply('```json\n{"a":1}\n```'));
      await expect(make().completeJson(req)).resolves.toEqual({ a: 1 });
    });

    it.each([
      ['not json at all', reply('Sure! Here you go'), /valid JSON/],
      ['truncated JSON', reply('{"a":'), /valid JSON/],
      ['empty text', reply(''), /valid JSON/],
      ['missing text', reply(undefined), /valid JSON/],
      ['a max-tokens cut-off', reply('{"a":', 'MAX_TOKENS'), /truncated/],
      ['a safety stop', reply('', 'SAFETY'), /declined/],
      ['a prohibited-content stop', reply('', 'PROHIBITED_CONTENT'), /declined/],
      ['a blocked prompt', reply('', 'STOP', { blockReason: 'SAFETY' }), /declined/],
    ])('raises LlmOutputError for %s', async (_n, body, pattern) => {
      generateContent.mockResolvedValue(body);
      const err: Error = await make().completeJson(req).then(() => new Error('did not throw'), (e: Error) => e);
      expect(err).toBeInstanceOf(LlmOutputError);
      expect(err.message).toMatch(pattern);
    });
  });

  describe('configuration and failures', () => {
    it('is unavailable without an API key and never creates a client or calls the network', async () => {
      const llm = make({});
      expect(llm.isConfigured).toBe(false);
      await expect(llm.completeJson(req)).rejects.toBeInstanceOf(LlmUnavailableError);
      await expect(llm.completeJson(req)).rejects.toThrow(/GEMINI_API_KEY/);
      expect(GoogleGenAI).not.toHaveBeenCalled();
      expect(generateContent).not.toHaveBeenCalled();
    });

    it('reports a non-retryable API error once, with the provider message and without the key', async () => {
      generateContent.mockRejectedValue(apiError(400, 'API key not valid. Please pass a valid API key.'));
      const err: Error = await make().completeJson(req).then(() => new Error('did not throw'), (e: Error) => e);
      expect(err).toBeInstanceOf(LlmOutputError);
      expect(err.message).toBe('LLM request failed (HTTP 400): API key not valid. Please pass a valid API key.');
      expect(err.message).not.toContain(KEY);
      expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it.each([429, 503])('retries once on HTTP %s and then succeeds', async (status) => {
      generateContent.mockRejectedValueOnce(apiError(status, 'busy')).mockResolvedValueOnce(reply('{"ok":true}'));
      await expect(make().completeJson(req)).resolves.toEqual({ ok: true });
      expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it('gives up after one retry', async () => {
      generateContent.mockRejectedValue(apiError(503, 'The model is overloaded.'));
      await expect(make().completeJson(req)).rejects.toThrow('LLM request failed (HTTP 503): The model is overloaded.');
      expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it('turns a network failure into LlmOutputError after one retry, without leaking details', async () => {
      generateContent.mockRejectedValue(Object.assign(new Error(`connect ECONNREFUSED ${KEY}`), { name: 'TypeError' }));
      const err: Error = await make().completeJson(req).then(() => new Error('did not throw'), (e: Error) => e);
      expect(err).toBeInstanceOf(LlmOutputError);
      expect(err.message).toBe('LLM request failed: TypeError');
      expect(err.message).not.toContain(KEY);
      expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it('handles an API error whose message is not JSON', async () => {
      generateContent.mockRejectedValue(new ApiError({ status: 404, message: 'models/x is not found' }));
      await expect(make().completeJson(req)).rejects.toThrow('LLM request failed (HTTP 404): models/x is not found');
    });
  });
});
