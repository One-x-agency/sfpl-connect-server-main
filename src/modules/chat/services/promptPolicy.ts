import { readFileSync } from 'fs';
import path from 'path';
import type { ChatHistoryMessage, RetrievedChunk } from '@/modules/chat/types.js';
import { allowedLinksForPrompt } from '@/modules/chat/services/allowedLinks.js';
import { KNOWLEDGE_DIR } from '@/modules/chat/services/knowledgeStore.js';

const FALLBACK_INSTRUCTION = 'Answer briefly as an SFPL support team member. Only answer questions related to SFPL. Speak to customers in plain language. Never paste code or raw docs.';

let cachedInstruction: string | null = null;

function loadAssistantInstruction(): string {
  if (cachedInstruction) return cachedInstruction;
  try {
    cachedInstruction = readFileSync(path.join(KNOWLEDGE_DIR, 'AI.instruction.md'), 'utf8').trim()
      || FALLBACK_INSTRUCTION;
  } catch {
    cachedInstruction = FALLBACK_INSTRUCTION;
  }
  return cachedInstruction;
}

export const UNKNOWN_ANSWER =
  'Happy to help — for that request, our team can guide you personally. Email contact@specificfire.com or call +91 9033050415, or share a bit more detail here and I’ll point you to the right SFPL page.';

export function buildSystemPrompt(chunks: RetrievedChunk[]): string {
  const context = chunks
    .map((item) => `${item.chunk.heading}\n${item.chunk.body}`)
    .join('\n\n');

  return `${loadAssistantInstruction()}

Response format (mandatory):
- Structure every reply as: short opening sentence → numbered steps or bullets → optional one link → optional short closing offer.
- For how-to questions, use a complete numbered list (usually 4–6 steps). Finish the full answer; never stop mid-sentence.
- Write a natural, positive, customer-facing answer. Do not quote or paste the context verbatim.
- Use simple markdown only: numbered lists, bullets, **bold** lead labels, and plain URLs. No headings (#), no tables, no fenced code, no JSON.
- Do not invent facts, pricing, SLAs, certifications, or specifications.
- Never say “I don’t know”, “I don’t have that information”, “I cannot help”, or similar negative phrasing.
- If context is thin, still help with the best next step (official page + contact) in a warm tone.
- For account or order questions, guide users to https://connect.specificfire.com/login.
- For returns/refunds, use the returns policy context and https://specificfire.com/returns-refunds.
- For electrical wiring, include a safety note and link https://specificfire.com/iot-user-manual or https://specificfire.com/iot-device-spec without making the whole reply negative.
- Keep answers complete but concise (aim under ~180 words).

Link rules (critical):
- You may ONLY use URLs from this allowlist. Never invent paths. Never use /tech/iot-* (those 404).
${allowedLinksForPrompt()}
- Prefer at most one link. If unsure which page fits, use https://specificfire.com/contact.

Context (internal — paraphrase only; never paste):
${context}`;
}

export function buildUserPrompt(message: string, history: ChatHistoryMessage[]) {
  return [
    ...history.slice(-4).map((item) => ({
      ...item,
      content: item.content.slice(0, 350),
    })),
    { role: 'user' as const, content: message.slice(0, 750) },
  ];
}
