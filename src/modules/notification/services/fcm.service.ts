import admin from 'firebase-admin';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import Logger from '@/service/logger/index.js';
import RegisterService from '@/core/registerService.js';
import type { Context as ServiceContext } from '@/core/registerService.js';
import type { Notification } from '@/modules/notification/notification.type.js';

const tokenValidationErrors = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/mismatched-credential',
  'messaging/invalid-argument',
];



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configJsonFilePath = path.join(__dirname, '../../../../FCM.json');

admin.initializeApp({
  credential: admin.credential.cert(configJsonFilePath),
});


export async function sendMulticastFirebaseNotificationService(ctx: ServiceContext, tokens: string[], notification: Notification) {

  if(!tokens.length) return;

  const message = {
    tokens,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification,
  };

  const results = await admin.messaging().sendEachForMulticast(message);

  const tokensToDelete = [];

  results.responses.forEach((result, index) => {
    if (!result.success) {
      if (tokenValidationErrors.includes(result.error?.code)){
        tokensToDelete.push(tokens[index]);
      }else{
        Logger.error(`Failed to send notification to token ${tokens[index]}`, result.error);
      }
    }
  });

  if (tokensToDelete.length > 0) {
    await ctx.database.query(`
      DELETE FROM notification_tokens
      WHERE token = ANY($1)
    `, [tokensToDelete]);
  }

  return results;
}

export const sendMulticastFirebaseNotification = RegisterService(sendMulticastFirebaseNotificationService);
