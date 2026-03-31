import dotenv from 'dotenv';

dotenv.config();

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const parseNumberInRange = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = parseNumber(value, fallback);
  return Math.min(Math.max(parsed, min), max);
};

const trimTrailingSlash = (value: string): string => value.replace(/\/$/, '');

export const env = {
  port: parseNumber(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
  deepseekBaseUrl: trimTrailingSlash(process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1'),
  deepseekModel: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  deepseekTimeoutMs: parseNumberInRange(process.env.DEEPSEEK_TIMEOUT_MS, 8000, 3000, 15000)
};

export const validateRequiredEnv = (): void => {
  const missing: string[] = [];

  if (!env.databaseUrl) {
    missing.push('DATABASE_URL');
  }

  if (!env.jwtSecret) {
    missing.push('JWT_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
