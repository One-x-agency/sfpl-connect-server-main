import RedisClient from '@/service/redis/index.js';

export async function deleteDeviceKeys() {
  const pattern = 'device:*';
  // Using scanIterator from node-redis v4
  const iterator = RedisClient.scanIterator({
    MATCH: pattern,
    COUNT: 100,
  });

  for await (const key of iterator) {
    if (key.length > 0) await RedisClient.del(key);
  }
}

