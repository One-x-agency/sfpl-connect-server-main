export type ChatRole = 'user' | 'assistant';

export interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
}

export interface KnowledgeChunk {
  id: string;
  heading: string;
  body: string;
  text: string;
  tokens: string[];
}

export interface RetrievedChunk {
  chunk: KnowledgeChunk;
  score: number;
}

export interface ChatAnswerResult {
  answer: string;
  usedLlm: boolean;
  cached: boolean;
}
