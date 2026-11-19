import env from '@/config/env.js';
import {
  getKnowledgeChunks,
  tokenizeQuery,
  tokenizeQueryCore,
} from '@/modules/chat/services/knowledgeStore.js';
import type { RetrievedChunk } from '@/modules/chat/types.js';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'do', 'does', 'of', 'in',
  'on', 'at', 'to', 'for', 'from', 'with', 'and', 'or', 'what', 'which', 'who',
  'where', 'when', 'why', 'how', 'can', 'could', 'should', 'would', 'will', 'me',
  'my', 'our', 'your', 'this', 'that', 'it', 'its', 'about', 'please', 'tell',
  'give', 'show', 'need', 'want', 'know', 'today', 'now',
]);

function meaningfulTokens(tokens: string[]): string[] {
  return [...new Set(tokens.filter((token) => !STOPWORDS.has(token) && token.length > 2))];
}

function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  averageLength: number,
  documentFrequency: Map<string, number>,
  totalDocuments: number,
): number {
  const frequencies = new Map<string, number>();
  for (const token of docTokens) frequencies.set(token, (frequencies.get(token) || 0) + 1);

  let score = 0;
  for (const term of new Set(queryTokens)) {
    const frequency = frequencies.get(term) || 0;
    if (!frequency) continue;
    const documentCount = documentFrequency.get(term) || 0;
    const inverseFrequency = Math.log(1 + (totalDocuments - documentCount + 0.5) / (documentCount + 0.5));
    const denominator = frequency + 1.4 * (0.25 + (0.75 * docTokens.length) / averageLength);
    score += inverseFrequency * ((frequency * 2.4) / denominator);
  }
  return score;
}

export function retrieveRelevantChunks(query: string): RetrievedChunk[] {
  const chunks = getKnowledgeChunks();
  const coreTokens = meaningfulTokens(tokenizeQueryCore(query));
  const queryTokens = tokenizeQuery(query);
  if (coreTokens.length === 0) return [];

  const averageLength = chunks.reduce((sum, chunk) => sum + chunk.tokens.length, 0) / chunks.length;
  const documentFrequency = new Map<string, number>();
  for (const term of new Set(queryTokens)) {
    documentFrequency.set(term, chunks.filter((chunk) => chunk.tokens.includes(term)).length);
  }

  return chunks
    .map((chunk) => {
      const documentTokens = new Set(chunk.tokens);
      const directHits = coreTokens.filter((token) => documentTokens.has(token)).length;
      const headingHits = tokenizeQuery(chunk.heading).filter((token) => queryTokens.includes(token)).length;
      const score = bm25Score(queryTokens, chunk.tokens, averageLength, documentFrequency, chunks.length)
        + headingHits * 1.8
        + (directHits / coreTokens.length) * 2;
      return { chunk, score, directHits };
    })
    .filter((item) => item.score >= env.openai.minRetrievalScore && item.directHits > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, env.openai.topK)
    .map(({ chunk, score }) => ({ chunk, score }));
}

export function truncateChunksToBudget(chunks: RetrievedChunk[], maxChars: number): RetrievedChunk[] {
  const selected: RetrievedChunk[] = [];
  let usedCharacters = 0;
  for (const item of chunks) {
    if (selected.length > 0 && usedCharacters + item.chunk.text.length > maxChars) break;
    selected.push(item);
    usedCharacters += item.chunk.text.length;
  }
  return selected;
}
