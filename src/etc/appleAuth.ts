import { createRemoteJWKSet, jwtVerify } from 'jose';
import env from '@/config/env.js';

export async function verifyAppleToken(identityToken: string) {
  // Fetch Apple's public JWKS and verify in one step
  const JWKS = createRemoteJWKSet(
    new URL('https://appleid.apple.com/auth/keys')
  );

  const { payload } = await jwtVerify(identityToken, JWKS, {
    issuer: 'https://appleid.apple.com',
    audience: env.apple.bundleId,
    algorithms: ['RS256'],
  });

  return payload;
  // payload contains: sub, email, email_verified, iat, exp
}
