import type { NextFunction, Request, Response } from 'express';
import { decodeJWTToken } from '@/utility/token.js';
import { TokenTypes } from '@/config/constant.js';
import Database from '@/service/database/index.js';

interface AccessTokenPayload {
  type: TokenTypes;
  customer_id?: string;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) return next();

  const tokenString = header.split(' ')[1];

  if (!tokenString) return next();

  const payload = await decodeJWTToken<AccessTokenPayload>(tokenString);

  if (!payload || payload?.type !== TokenTypes.CUSTOMER_ACCESS_TOKEN) return next();

  const customerId = payload.customer_id;

  const activeCustomer = await Database.queryOne<{ id: string }>(
    `
      SELECT id
      FROM users
      WHERE id = $1
        AND role = 'customer'
        AND is_deleted = false
    `,
    [customerId],
  );

  if (!activeCustomer) {
    return res.status(401).json({ code: 'unauthorized', message: 'Invalid token' });
  }

  req.user = {
    id: customerId,
  };

  next();
}

export default requireAuth;

