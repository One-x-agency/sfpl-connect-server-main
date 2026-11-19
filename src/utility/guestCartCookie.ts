import type { CookieOptions, Response } from 'express';
import env from '@/config/env.js';

export const GUEST_CART_COOKIE_NAME = 'sfpl_guest_cart_id';

const GUEST_CART_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function cookieDomain() {
  return env.env === 'development' ? '.localhost.com' : '.specificfire.com';
}

export function guestCartCookieOptions(): CookieOptions {
  return {
    domain: cookieDomain(),
    httpOnly: false,
    secure: env.env !== 'development',
    sameSite: env.env === 'development' ? 'lax' : 'none',
    maxAge: GUEST_CART_MAX_AGE_MS,
    path: '/',
  };
}

export function isValidGuestCartId(value: string | undefined | null): value is string {
  return Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
}

export function setGuestCartCookie(res: Response, guestCartId: string) {
  res.cookie(GUEST_CART_COOKIE_NAME, guestCartId, guestCartCookieOptions());
}

export function clearGuestCartCookie(res: Response) {
  const options = guestCartCookieOptions();
  res.clearCookie(GUEST_CART_COOKIE_NAME, options);
  // Also clear host-only variant if present.
  res.clearCookie(GUEST_CART_COOKIE_NAME, { path: '/' });
}
