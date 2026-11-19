import Logger from '@/service/logger/index.js';
import type { Context } from '@/core/registerSocketEventHandler.js';

export async function Handler({ socket }: Context){

  const userId = socket.data.user!.id;

  Logger.info(`User disconnected: ${userId} (socket: ${socket.id})`);

}
