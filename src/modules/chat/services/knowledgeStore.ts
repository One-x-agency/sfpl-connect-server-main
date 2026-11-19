import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { KnowledgeChunk } from '@/modules/chat/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Server-root `knowledge/` — works from both `src/` (tsx) and `dist/` (compiled). */
export const KNOWLEDGE_DIR = path.join(__dirname, '../../../../knowledge');

const SYNONYMS: Record<string, string[]> = {
  connect: ['sfpl connect', 'iot', 'io1', 'o1'],
  iot: ['connect', 'device', 'sensor'],
  device: ['hardware', 'iot', 'connect'],
  portal: ['dashboard', 'web', 'login', 'app'],
  alert: ['notification', 'threshold', 'alarm'],
  amc: ['maintenance', 'inspection'],
  contact: ['phone', 'email', 'support', 'call'],
  phone: ['contact', 'email', 'call', 'support'],
  number: ['phone', 'contact'],
  email: ['contact', 'support'],
  wiring: ['install', 'pin', 'ct', 'analog'],
  battery: ['backup', 'power'],
  gsm: ['network', 'sim', '2g'],
  pin: ['input', 'analog', 'io'],
  pins: ['input', 'analog', 'io'],
  buy: ['purchase', 'order', 'store'],
  purchase: ['buy', 'order', 'store'],
  warranty: ['guarantee', 'cover', 'refund', 'return'],
  password: ['login', 'forgot', 'reset'],
  login: ['sign', 'portal', 'password'],
  refund: ['return', 'refunds', 'returns', 'money back', 'claim'],
  refunds: ['return', 'refund', 'returns', 'money back', 'claim'],
  return: ['refund', 'returns', 'refunds', 'claim'],
  returns: ['refund', 'return', 'refunds', 'claim'],
};

let cachedChunks: KnowledgeChunk[] | null = null;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function expandTokens(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const item of SYNONYMS[token] || []) {
      for (const part of tokenize(item)) expanded.add(part);
    }
  }
  return [...expanded];
}

export function tokenizeQuery(text: string): string[] {
  return expandTokens(tokenize(text));
}

export function tokenizeQueryCore(text: string): string[] {
  return tokenize(text);
}

/** Strip fenced code so the model cannot copy-paste code/JSON from docs. */
function stripCodeFences(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]+`/g, ' ');
}

function splitMarkdown(markdown: string, sourceLabel: string): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  let heading = sourceLabel;
  let bodyLines: string[] = [];

  const flush = () => {
    const body = bodyLines.join('\n').trim();
    bodyLines = [];
    if (!body) return;
    const text = `${heading}\n${body}`;
    chunks.push({
      id: `chunk-${sourceLabel}-${chunks.length}`,
      heading,
      body,
      text,
      tokens: tokenize(text),
    });
  };

  for (const line of markdown.split(/\r?\n/)) {
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    const labelledSectionMatch = /^\*\*([^*]+):\*\*\s*(.*)$/.exec(line);
    if (headingMatch) {
      flush();
      heading = headingMatch[2]?.trim() || heading;
    } else if (labelledSectionMatch) {
      flush();
      heading = labelledSectionMatch[1]?.trim() || heading;
      if (labelledSectionMatch[2]) bodyLines.push(labelledSectionMatch[2]);
    } else {
      bodyLines.push(line);
    }
  }
  flush();
  return chunks;
}

export function getKnowledgeChunks(): KnowledgeChunk[] {
  if (cachedChunks) return cachedChunks;

  const files = readdirSync(KNOWLEDGE_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'AI.instruction.md')
    .sort();

  const chunks: KnowledgeChunk[] = [];
  for (const file of files) {
    const raw = readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf8');
    const cleaned = stripCodeFences(raw);
    chunks.push(...splitMarkdown(cleaned, file.replace(/\.md$/i, '')));
  }

  if (chunks.length === 0) {
    throw new Error('Knowledge directory produced zero chunks');
  }

  cachedChunks = chunks;
  return cachedChunks;
}
