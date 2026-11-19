/**
 * Only these public URLs may appear in chatbot answers.
 * Keep in sync with live sfpl-web routes.
 */
export const ALLOWED_PUBLIC_LINKS = [
  'https://specificfire.com',
  'https://specificfire.com/connect',
  'https://specificfire.com/services',
  'https://specificfire.com/tech',
  'https://specificfire.com/about',
  'https://specificfire.com/jobs',
  'https://specificfire.com/contact',
  'https://specificfire.com/iot-device-spec',
  'https://specificfire.com/iot-user-manual',
  'https://specificfire.com/iot-faq',
  'https://specificfire.com/privacy-policy',
  'https://specificfire.com/terms-conditions',
  'https://specificfire.com/returns-refunds',
  'https://specificfire.com/connect-o1-warranty',
  'https://specificfire.com/copyright-policy',
  'https://connect.specificfire.com',
  'https://connect.specificfire.com/login',
  'https://play.google.com/store/apps/details?id=com.specificfire.sfpl',
  'https://apps.apple.com/vn/app/specific-fire/id6761681939',
] as const;

const FALLBACK_LINK = 'https://specificfire.com/contact';

/** Legacy metadata paths that 404 — never suggest these. */
const BLOCKED_PATHS = new Set([
  '/tech/iot-faq',
  '/tech/iot-user-manual',
  '/tech/iot-device-spec',
]);

const URL_PATTERN = /https?:\/\/[^\s)\]>"']+/gi;

const ALLOWED_SET = new Set(
  ALLOWED_PUBLIC_LINKS.map((link) => normalizeKey(link)).filter(Boolean) as string[],
);

function splitTrailingPunctuation(raw: string): { core: string; trailing: string } {
  const match = raw.match(/^(.*?)([.,;:!?)]*)$/);
  return {
    core: match?.[1] || raw,
    trailing: match?.[2] || '',
  };
}

function normalizeKey(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    let pathname = url.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

    if (host === 'play.google.com' || host === 'apps.apple.com') {
      return `${url.protocol}//${host}${pathname}${url.search}`.toLowerCase();
    }

    return `${url.protocol}//${host}${pathname === '' ? '/' : pathname}`.toLowerCase();
  } catch {
    return null;
  }
}

function isAllowedUrl(raw: string): boolean {
  const key = normalizeKey(raw);
  if (!key) return false;

  try {
    const pathname = new URL(raw).pathname.replace(/\/$/, '') || '/';
    if (BLOCKED_PATHS.has(pathname)) return false;
  } catch {
    return false;
  }

  if (ALLOWED_SET.has(key)) return true;

  // Exact app-store match already covered; also allow portal root variants
  return ALLOWED_SET.has(key.replace(/\/$/, ''));
}

export function allowedLinksForPrompt(): string {
  return [
    'https://specificfire.com/',
    'https://specificfire.com/connect',
    'https://specificfire.com/services',
    'https://specificfire.com/tech',
    'https://specificfire.com/about',
    'https://specificfire.com/jobs',
    'https://specificfire.com/contact',
    'https://specificfire.com/iot-device-spec',
    'https://specificfire.com/iot-user-manual',
    'https://specificfire.com/iot-faq',
    'https://specificfire.com/privacy-policy',
    'https://specificfire.com/terms-conditions',
    'https://specificfire.com/returns-refunds',
    'https://specificfire.com/connect-o1-warranty',
    'https://specificfire.com/copyright-policy',
    'https://connect.specificfire.com/login',
  ].map((link) => `- ${link}`).join('\n');
}

/** Replace any non-allowlisted URL with the contact page. */
export function sanitizeAnswerLinks(answer: string): string {
  return answer.replace(URL_PATTERN, (match) => {
    const { core, trailing } = splitTrailingPunctuation(match);
    if (isAllowedUrl(core)) return `${core}${trailing}`;
    return `${FALLBACK_LINK}${trailing}`;
  });
}
