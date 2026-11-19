import ServerError from '@/core/serverError.class.js';
import { decodeJWTToken } from '@/utility/token.js';
import { Socket } from 'socket.io';
import { TokenTypes } from '@/config/constant.js';

export default async function validateUserSocketHandShake(socket: Socket, next: (err?: Error) => void) {
  try {

    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

    if (!token) throw new ServerError('token is required');
    if (!token.startsWith('Bearer ')) throw new ServerError('invalid token');

    const tokenString = token.split(' ')[1];
    if (!tokenString) throw new ServerError('token is required');

    const payload  = await decodeJWTToken(tokenString);
    if (
      !payload
      || (
        payload.type !== TokenTypes.USER_ACCESS_TOKEN
        && payload.type !== TokenTypes.CUSTOMER_ACCESS_TOKEN
        && payload.type !== 'diagram_access_token'
      )
    ) throw new ServerError('invalid token');

    if (payload.type === TokenTypes.USER_ACCESS_TOKEN) {
      socket.join(payload.user_id as string);
    } else if (payload.type === TokenTypes.CUSTOMER_ACCESS_TOKEN) {
      socket.join(payload.customer_id as string);
    } else if (payload.type === 'diagram_access_token') {
      if (!payload.user_id) throw new ServerError('invalid token');
      socket.join(payload.user_id as string);
    }

    next();
  } catch (error) {
    next(error);
  }
}
