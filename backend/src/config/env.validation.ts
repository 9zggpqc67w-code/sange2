import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  // Google Gemini (document extraction + the agent). Without a key, LLM-backed steps fail gracefully.
  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  @IsString()
  GEMINI_MODEL: string = 'gemini-3.5-flash-lite';

  @IsString()
  UPLOAD_DIR: string = './uploads';
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.toString()}`);
  }
  return validated;
}
