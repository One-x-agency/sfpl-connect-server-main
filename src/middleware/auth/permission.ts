import type { NextFunction, Request, Response } from 'express';
import { decodeJWTToken } from '@/utility/token.js';
import { TokenTypes } from '@/config/constant.js';
import Database from '@/service/database/index.js';
import type { StaffRole } from '@/constants/user-role.js';
import { isStaffRole } from '@/constants/user-role.js';

interface AccessTokenPayload {
  type: TokenTypes;
  user_id?: string;
  session_id?: string;
}

export default function permission(...allowedRoles: StaffRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
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

    const user = await Database.queryOne<{ id: string; role: string }>(
      'SELECT id, role FROM users WHERE id = $1 AND is_deleted = false AND is_active = true',
      [userId],
    );

    if (!user || !isStaffRole(user.role)) {
      return res.status(401).json({ code: 'unauthorized', message: 'Invalid token' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ code: 'forbidden', message: 'You do not have permission to access this resource' });
    }

    req.user = {
      id: user.id,
      role: user.role,
    };

    next();
  };
}
