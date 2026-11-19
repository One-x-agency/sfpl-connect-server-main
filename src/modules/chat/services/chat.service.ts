import env from '@/config/env.js';
import ServerError from '@/core/serverError.class.js';
import Logger from '@/service/logger/index.js';
import { sanitizeAnswerLinks } from '@/modules/chat/services/allowedLinks.js';
import { cacheAnswer, getCachedAnswer } from '@/modules/chat/services/chatCache.js';
import { resolveConversationalReply } from '@/modules/chat/services/conversationIntent.js';
import { generateChatAnswer } from '@/modules/chat/services/openaiClient.js';
import { UNKNOWN_ANSWER } from '@/modules/chat/services/promptPolicy.js';
import { assertChatRateLimit } from '@/modules/chat/services/rateLimiter.js';
import { retrieveRelevantChunks, truncateChunksToBudget } from '@/modules/chat/services/retriever.js';
import type { ChatAnswerResult, ChatHistoryMessage } from '@/modules/chat/types.js';

export async function answerChatMessage(params: {
  clientId: string;
  message: string;
  history?: ChatHistoryMessage[];
}): Promise<ChatAnswerResult> {
  const rate = await assertChatRateLimit(params.clientId);
  if (rate.ok === false) {
    throw new ServerError(`Too many chat requests. Try again in ${rate.retryAfterSec}s.`);
  }

  const message = params.message.trim();
  const history = (params.history || []).slice(-4);

  const conversational = resolveConversationalReply(message);
  if (conversational) {
    return { answer: conversational, usedLlm: false, cached: false };
  }

  if (history.length === 0) {
    const cachedAnswer = await getCachedAnswer(message);
    if (cachedAnswer) return { answer: cachedAnswer, usedLlm: false, cached: true };
  }

  const retrievalQuery = [
    ...history.filter((item) => item.role === 'user').map((item) => item.content),
    message,
  ].join(' ');

  const chunks = truncateChunksToBudget(
    retrieveRelevantChunks(retrievalQuery),
    env.openai.maxContextChars,
  );

  if (chunks.length === 0) {
    return { answer: UNKNOWN_ANSWER, usedLlm: false, cached: false };
  }

  try {
    const answer = sanitizeAnswerLinks(await generateChatAnswer(message, history, chunks));
    if (history.length === 0) await cacheAnswer(message, answer);
    return { answer, usedLlm: true, cached: false };
  } catch (error) {
    if (error instanceof ServerError) throw error;

    const openAiError = error as { status?: number; code?: string; message?: string };
    Logger.error('Chat OpenAI request failed', {
      status: openAiError.status,
      code: openAiError.code,
      message: openAiError.message,
    });

    if (openAiError.status === 429 || openAiError.code === 'rate_limit_exceeded') {
      throw new ServerError('AI service is busy. Please try again shortly.');
    }
    if (
      openAiError.code === 'ETIMEDOUT'
      || openAiError.message?.toLowerCase().includes('timeout')
    ) {
      throw new ServerError('AI request timed out. Please try again.');
    }
    if (openAiError.status === 401 || openAiError.code === 'invalid_api_key') {
      throw new ServerError('AI chat is misconfigured. Please contact support.');
    }
    throw new ServerError('Unable to get an AI answer right now. Please try again.');
  }
}
