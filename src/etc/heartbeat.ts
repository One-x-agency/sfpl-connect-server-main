import type { Request, Response } from 'express';
import env from '@/config/env.js';
import Database from '@/service/database/index.js';
import RedisClient from '@/service/redis/index.js';

export async function heartbeatHandler(_req: Request, res: Response) {
  const checks = {
    database: 'error' as 'ok' | 'error',
    redis: 'error' as 'ok' | 'error',
  };

  try {
    await Database.queryOne('SELECT 1 AS ok');
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    if (RedisClient.isOpen) {
      await RedisClient.ping();
      checks.redis = 'ok';
    }
  } catch {
    checks.redis = 'error';
  }

  const healthy = checks.database === 'ok' && checks.redis === 'ok';

  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: env.serviceName,
    env: env.env,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks,
  });
}
