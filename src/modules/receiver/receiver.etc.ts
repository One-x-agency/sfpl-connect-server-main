import { Queue } from 'bullmq';
import env from '@/config/env.js';


export const customNotificationQueue = new Queue('custom-notification', {
  connection: {
    url: env.redis.url,
  },
});
