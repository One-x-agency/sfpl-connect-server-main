import type { Context } from '@/core/registerService.js';
import ServerError from '@/core/serverError.class.js';
import RegisterService from '@/core/registerService.js';


async function createSessionService(
  ctx: Context,
  userId: string,
  expiresAt: Date,
) {
  const db = ctx.database!;
  const session = await db.queryOne(
    `
      INSERT INTO user_sessions (user_id, expires_at)
      VALUES ($1, $2)
      RETURNING id, user_id, is_active, created_at, expires_at, logged_out_at
    `,
    [userId, expiresAt],
  );

  if (!session) {
    throw new ServerError('Failed to create session');
  }

  return session;
}


export const createSession = RegisterService(createSessionService);
