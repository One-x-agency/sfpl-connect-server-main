import OpenAI from 'openai';
import env from '@/config/env.js';
import ServerError from '@/core/serverError.class.js';
import { buildSystemPrompt, buildUserPrompt } from '@/modules/chat/services/promptPolicy.js';
import type { ChatHistoryMessage, RetrievedChunk } from '@/modules/chat/types.js';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!env.openai.apiKey) {
    throw new ServerError('AI chat is not configured. Please contact support.');
  }
  client ||= new OpenAI({
    apiKey: env.openai.apiKey,
    timeout: env.openai.timeoutMs,
    maxRetries: 1,
  });
  return client;
}

export async function generateChatAnswer(
  message: string,
  history: ChatHistoryMessage[],
  chunks: RetrievedChunk[],
): Promise<string> {
  const response = await getClient().responses.create({
    model: env.openai.model,
    max_output_tokens: env.openai.maxOutputTokens,
    temperature: 0.2,
    instructions: buildSystemPrompt(chunks),
    input: buildUserPrompt(message, history),
  });

  const answer = response.output_text?.trim();
  if (!answer) throw new ServerError('AI returned an empty answer. Please try again.');
  return answer;
}
