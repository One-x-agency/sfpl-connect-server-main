import z from 'zod';
import { validateSafe } from './validationHelper.js';



export default function validateEnv(schema: z.ZodSchema, envs: any) {
  const result = validateSafe(schema, envs);

  if (!result.success) {
    console.log(`Invalid ENV options : ${result.error?.message}`, result.error?.details);
    process.exit(1);
  }

  return result.data;
}
