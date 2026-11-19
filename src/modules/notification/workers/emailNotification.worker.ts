import { Worker } from 'bullmq';
import Database from '@/service/database/index.js';
import env from '@/config/env.js';
import deviceAlertEmailTemplate from '@/utility/emailTemplates/deviceAlert.js';
import { sendMail } from '@/service/mail/index.js';


export const customerNotificationWorker = new Worker('email-notification', async (job) => {
  const {
    users, notification,
  } = job.data;

  if (notification.type !== 'custom_notification') return;

  const [device, usersToSend] = await Promise.all([
    Database.queryOne(
      'SELECT id, name, latitude, longitude FROM devices WHERE id = $1 ',
      [notification.device_id]
    ),
    Database.queryAll(
      'SELECT id, email FROM users WHERE id = ANY($1)',
      [users]
    )
  ]);

  const html = deviceAlertEmailTemplate({
    deviceName: device.name,
    latitude: device.latitude,
    longitude: device.longitude,
    faultInput: `${notification.title} - ${notification.body}`,
  });

  await sendMail({
    to: usersToSend.map(user => user.email),
    subject: notification.title,
    html,
  });

  Database.query(
    `
    INSERT INTO notification_logs (user_id, type, transport, description, meta_data)
    SELECT unnest($1::uuid[]), $2, $3, $4, $5
    `,
    [
      users, notification.type, 'email', 'Condition hit for custom notification',
      {
        device_id: device.id,
        input_field_id: notification.input_field_id,
        custom_notification_schema_id: notification.custom_notification_schema_id,
      }
    ]
  );

}, {
  connection: {
    url: env.redis.url,
  },
});


customerNotificationWorker.on('failed', (job, error) => {
  console.error(`Email notification failed: ${error}`);
});
