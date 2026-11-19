import { createHash } from 'crypto';
import env from '@/config/env.js';
import RedisClient from '@/service/redis/index.js';

function cacheKey(message: string): string {
  const normalized = message.trim().toLowerCase().replace(/\s+/g, ' ');
  return `chat:answer:v4:${createHash('sha256').update(normalized).digest('hex')}`;
}

export async function getCachedAnswer(message: string): Promise<string | null> {
  if (!RedisClient.isOpen) await RedisClient.connect();
  const answer = await RedisClient.get(cacheKey(message));
  if (answer === null) return null;
  return answer.toString();
}

export async function cacheAnswer(message: string, answer: string): Promise<void> {
  if (!RedisClient.isOpen) await RedisClient.connect();
  await RedisClient.set(cacheKey(message), answer, { EX: env.openai.cacheTtlSeconds });
}
