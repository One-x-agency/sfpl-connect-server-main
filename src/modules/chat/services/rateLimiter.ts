import env from '@/config/env.js';
import RedisClient from '@/service/redis/index.js';

export async function assertChatRateLimit(clientId: string): Promise<
  { ok: true } | { ok: false; retryAfterSec: number }
> {
  if (!RedisClient.isOpen) await RedisClient.connect();

  const key = `chat:rate:${clientId}`;
  const count = Number(await RedisClient.incr(key));
  if (count === 1) {
    await RedisClient.pExpire(key, env.openai.rateLimitWindowMs);
  }

  if (count <= env.openai.rateLimitMax) return { ok: true };

  const remainingMs = Number(await RedisClient.pTTL(key));
  return {
    ok: false,
    retryAfterSec: Math.max(1, Math.ceil(remainingMs / 1000)),
  };
}
