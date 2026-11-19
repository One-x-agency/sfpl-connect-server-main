/** Lightweight intent helpers so greetings don't hit the "not in docs" fallback. */

const TRAILING = String.raw`[\s!.,?]*$`;

const GREETING = new RegExp(
  String.raw`^(hi+|hii+|hello+|hey+|heya|howdy|hola|yo+|sup|good\s*(morning|afternoon|evening|night)|namaste|hiya)\b` + TRAILING,
  'i',
);

const THANKS = new RegExp(
  String.raw`^(thanks|thank\s*you|thx|ty|appreciate\s*it|thanks?\s*(a\s*lot|so\s*much)?)\b` + TRAILING,
  'i',
);

const BYE = new RegExp(
  String.raw`^(bye+|goodbye|good\s*bye|see\s*ya|see\s*you|take\s*care|later)\b` + TRAILING,
  'i',
);

const HELP = new RegExp(
  String.raw`^(help|what\s+can\s+you\s+(do|help\s+with)|who\s+are\s+you|what\s+are\s+you)\b` + TRAILING,
  'i',
);

export const GREETING_ANSWER =
  "Hi! How can I help you today? You can ask about SFPL CONNECT, our fire-safety services, the portal, app, or policies.";

export const THANKS_ANSWER =
  "You're welcome! If you have another question about SFPL or SFPL CONNECT, just ask.";

export const BYE_ANSWER =
  "Thanks for chatting. If you need anything else about SFPL CONNECT, we're here — or reach us at contact@specificfire.com / +91 9033050415.";

export const HELP_ANSWER =
  "I can help with SFPL CONNECT (device, portal, app), fire-safety services, buying/warranty, and common how-to questions. What would you like to know?";

export function resolveConversationalReply(message: string): string | null {
  const text = message.trim();
  if (!text || text.length > 80) return null;
  if (GREETING.test(text)) return GREETING_ANSWER;
  if (THANKS.test(text)) return THANKS_ANSWER;
  if (BYE.test(text)) return BYE_ANSWER;
  if (HELP.test(text)) return HELP_ANSWER;
  return null;
}
