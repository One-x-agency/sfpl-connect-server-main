import type { CookieOptions, Response } from 'express';
import env from '@/config/env.js';

export const CUSTOMER_AUTH_COOKIE_NAMES = {
  token: 'sfpl_customer_token',
  user: 'sfpl_customer_user',
  refreshToken: 'sfpl_customer_refresh_token',
} as const;

const LEGACY_COOKIE_NAMES = ['token', 'user', 'refresh_token'] as const;

type CustomerAuthUser = {
  id: string;
  name: string;
  email: string;
};

function cookieDomain() {
  return env.env === 'development' ? '.localhost.com' : '.specificfire.com';
}

function shortLivedCookieOptions(): CookieOptions {
  return {
    domain: cookieDomain(),
    httpOnly: false,
    secure: env.env !== 'development',
    sameSite: env.env === 'development' ? 'lax' : 'none',
    maxAge: 1 * 60 * 60 * 1000,
    path: '/',
  };
}

function refreshCookieOptions(): CookieOptions {
  return {
    ...shortLivedCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function clearCookieOptionSets(): CookieOptions[] {
  const devOptions: CookieOptions = {
    domain: '.localhost.com',
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    path: '/',
  };

  const prodOptions: CookieOptions = {
    domain: '.specificfire.com',
    httpOnly: false,
    secure: true,
    sameSite: 'none',
    path: '/',
  };

  const noDomainOptions: CookieOptions = {
    httpOnly: false,
    secure: env.env !== 'development',
    sameSite: env.env === 'development' ? 'lax' : 'none',
    path: '/',
  };

  return [devOptions, prodOptions, noDomainOptions];
}

function clearCookieByName(res: Response, name: string) {
  clearCookieOptionSets().forEach((options) => {
    res.clearCookie(name, options);
  });
}

export function clearCustomerAuthCookies(res: Response) {
  Object.values(CUSTOMER_AUTH_COOKIE_NAMES).forEach((name) => {
    clearCookieByName(res, name);
  });
  LEGACY_COOKIE_NAMES.forEach((name) => {
    clearCookieByName(res, name);
  });
}

export function setCustomerAuthCookies(
  res: Response,
  payload: { accessToken: string; refreshToken: string; user: CustomerAuthUser },
) {
  LEGACY_COOKIE_NAMES.forEach((name) => {
    clearCookieByName(res, name);
  });

  res.cookie(
    CUSTOMER_AUTH_COOKIE_NAMES.refreshToken,
    payload.refreshToken,
    refreshCookieOptions(),
  );
  res.cookie(
    CUSTOMER_AUTH_COOKIE_NAMES.token,
    payload.accessToken,
    shortLivedCookieOptions(),
  );
  res.cookie(
    CUSTOMER_AUTH_COOKIE_NAMES.user,
    payload.user,
    shortLivedCookieOptions(),
  );
}
