import type { NextFunction, Request, Response } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { decodeJWTToken } from '@/utility/token.js';
import { TokenTypes } from '@/config/constant.js';
import Database from '@/service/database/index.js';
import {
  GUEST_CART_COOKIE_NAME,
  isValidGuestCartId,
  setGuestCartCookie,
} from '@/utility/guestCartCookie.js';

interface AccessTokenPayload {
  type: TokenTypes;
  customer_id?: string;
}

/**
 * Soft auth for storefront:
 * - No Authorization → guest cart (from sfpl_guest_cart_id cookie)
 * - Valid customer access token → customer cart
 * - Authorization present but invalid/expired → 401 so clients can refresh
 */
async function parseStorefrontAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  let customerId: string | null = null;

  if (header?.startsWith('Bearer ')) {
    const tokenString = header.split(' ')[1];

    if (!tokenString) {
      return res.status(401).json({ code: 'unauthorized', message: 'Token is required' });
    }

    const payload = await decodeJWTToken<AccessTokenPayload>(tokenString);

    if (!payload || payload.type !== TokenTypes.CUSTOMER_ACCESS_TOKEN || !payload.customer_id) {
      return res.status(401).json({ code: 'unauthorized', message: 'Invalid token' });
    }

    const activeCustomer = await Database.queryOne<{ id: string }>(
      `SELECT id
       FROM users
       WHERE id = $1
         AND role = 'customer'
         AND is_deleted = false`,
      [payload.customer_id],
    );

    if (!activeCustomer) {
      return res.status(401).json({ code: 'unauthorized', message: 'Invalid token' });
    }

    customerId = activeCustomer.id;
  }

  let guestCartId: string | null = null;

  if (!customerId) {
    const fromCookie = typeof req.cookies?.[GUEST_CART_COOKIE_NAME] === 'string'
      ? req.cookies[GUEST_CART_COOKIE_NAME].trim()
      : null;

    if (isValidGuestCartId(fromCookie)) {
      guestCartId = fromCookie;
    } else {
      guestCartId = uuidv7();
      setGuestCartCookie(res, guestCartId);
    }
  }

  req.storefront = {
    customerId,
    guestCartId: customerId ? null : guestCartId,
  };

  if (customerId) {
    req.user = { id: customerId };
  }

  next();
}

export default parseStorefrontAuth;
