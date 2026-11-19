import type { NextFunction, Request, Response } from 'express';
import { decodeJWTToken } from '@/utility/token.js';
import { TokenTypes } from '@/config/constant.js';

interface AccessTokenPayload {
  type: TokenTypes;
  user_id?: string;
  session_id?: string;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'unauthorized', message: 'Authorization header missing or invalid' });
  }

  const tokenString = header.split(' ')[1];

  if (!tokenString) {
    return res.status(401).json({ code: 'unauthorized', message: 'Token is required' });
  }

  const payload = await decodeJWTToken<AccessTokenPayload>(tokenString);

  if (!payload || payload.type !== TokenTypes.USER_ACCESS_TOKEN || !payload.user_id) {
    return res.status(401).json({ code: 'unauthorized', message: 'Invalid token' });
  }

  const userId = payload.user_id;

  req.user = {
    id: userId,
  };


  next();
}

export default requireAuth;

