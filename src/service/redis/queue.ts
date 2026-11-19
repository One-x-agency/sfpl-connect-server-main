import { Queue } from 'bullmq';
import env from '@/config/env.js';


export default class QueueService {

  private static queues: { [key: string]: Queue } = {};

  static get(name: string): Queue {
    if (!this.queues[name]) {
      this.queues[name] = new Queue(name, {
        connection: {
          url: env.redis.url,
        },
      });
    }
    return this.queues[name];
  }
};
