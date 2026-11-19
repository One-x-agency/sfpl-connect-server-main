import type { Context as ServiceContext } from '@/core/registerService.js';
import RegisterService from '@/core/registerService.js';
import type { Notification } from '../notification.type.js';
import Socket from '@/socket.js';
import { sendMulticastFirebaseNotification } from './fcm.service.js';
import QueueService from '@/service/redis/queue.js';

const emailNotificationQueue = QueueService.get('email-notification');

async function createNotificationService(
  ctx: ServiceContext,
  userIds: string[],
  notification: Notification
) {
  if (!userIds.length) return [];

  const {
    title, body, type, ...data
  } = notification;

  const notifications = await ctx.database.queryAll(
    `
    INSERT INTO notifications (user_id, type, title, body, data)
    SELECT unnest($1::uuid[]), $2, $3, $4, $5
    RETURNING id, user_id, type, title, body, meta_data, created_at
    `,
    [userIds, type, title, body, data],
  );
  return notifications;
}

async function generateUserNotificationService(
  ctx: ServiceContext,
  userIds: string[],
  notification: Notification,
  transports: {
    email?: boolean;
    sms?: boolean;
    push_notification?: boolean;
    database?: boolean;
  }={
    email: false,
    sms: false,
    push_notification: true,
    database: true,
  }
) {
  if(!userIds.length) return;

  const {
    email: sendEmail = false,
    push_notification: sendPushNotification = true,
    database: sendDatabase = true
  } = transports;

  if (sendDatabase) {
    await createNotificationService(ctx, userIds, notification);
    Socket.io.to(userIds).emit('notification', notification);
  }

  if (sendPushNotification) {
    const tokens = await ctx.database.queryAll(
      'SELECT token FROM notification_tokens WHERE user_id = ANY($1)',
      [userIds]
    );
    await sendMulticastFirebaseNotification(ctx, tokens.map(token => token.token), notification);
  }

  if (sendEmail) {
    await emailNotificationQueue.add('email-notification', {
      users: userIds,
      notification,
    });
  }

}

export const generateUserNotification = RegisterService(generateUserNotificationService);
