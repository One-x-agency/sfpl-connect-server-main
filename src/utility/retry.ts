import env from '@/config/env.js';
import Logger from '@/service/logger/index.js';

const STARTUP_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withStartupRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const attempts = env.env === 'production' ? STARTUP_RETRY_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);

      if (attempt < attempts) {
        Logger.warn(`${label} failed (attempt ${attempt}/${attempts}): ${message}. Retrying in 5 minutes...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        Logger.error(`${label} failed after ${attempts} attempt(s)`, error);
      }
    }
  }

  throw lastError;
}
