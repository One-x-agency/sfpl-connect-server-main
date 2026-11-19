import { timingSafeEqual } from 'crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import env from '@/config/env.js';
import validate from '@/middleware/requestValidator.js';
import {
  Controller as postChat,
  ValidationSchema as postChatValidationSchema,
} from '@/modules/chat/controllers/postChat.js';

const router = Router();

function requireWebChatSecret(req: Request, res: Response, next: NextFunction) {
  const providedSecret = req.get('x-sfpl-chat-secret') || '';
  const expectedSecret = env.openai.webChatSecret;
  const providedBuffer = Buffer.from(providedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (
    !expectedSecret
    || providedBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return res.status(401).json({ code: 'unauthorized', message: 'Unauthorized.' });
  }

  return next();
}

router.post(
  '/chat',
  requireWebChatSecret,
  validate(postChatValidationSchema),
  (req, res, next) => {
    postChat(req, res, next).catch(next);
  },
);

export default router;
