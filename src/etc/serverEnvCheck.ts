import z from 'zod';
import env from '@/config/env.js';
import validateEnv from '@/utility/validateEnv.js';

const envSchema = z.object({
  env: z.enum(['local', 'development', 'stage', 'production']),
  port: z.coerce.number().int().positive().max(65535),
  serviceName: z.string().min(3).max(255),
});

validateEnv(envSchema, {
  env: env.env,
  port: env.port,
  serviceName: env.serviceName,
});
