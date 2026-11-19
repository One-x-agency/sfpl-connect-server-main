import type { NextFunction, Request, Response } from 'express';
import z from 'zod';
import { HttpStatusCodes } from '@/config/constant.js';
import { answerChatMessage } from '@/modules/chat/services/chat.service.js';

export const ValidationSchema = {
  body: z.object({
    message: z.string().trim().min(1).max(750),
    history: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().trim().min(1).max(350),
    })).max(4).optional(),
  }),
};

export async function Controller(req: Request, res: Response, _next: NextFunction) {
  const clientId = req.get('x-sfpl-chat-client');
  if (!clientId || !/^[a-f0-9]{64}$/.test(clientId)) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      code: 'invalid_client',
      message: 'Invalid chat client identifier.',
    });
  }

  const result = await answerChatMessage({
    clientId,
    message: req.body.message,
    history: req.body.history,
  });

  return res.status(HttpStatusCodes.OK).json({
    data: { answer: result.answer },
  });
}
