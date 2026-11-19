import Database from '@/service/database/index.js';
import RedisClient, { Publisher, Subscriber } from '@/service/redis/index.js';
import mqttClient from '@/mqttClient.js';
import Logger from '@/service/logger/index.js';
import { deleteDeviceKeys } from '@/etc/resetRedis.js';
import { withStartupRetry } from '@/utility/retry.js';

const MQTT_CONNECT_TIMEOUT_MS = 15000;

async function connectDatabase(): Promise<void> {
  await Database.queryOne('SELECT 1 AS ok');
  Logger.info('Database connected successfully ✅');
}

async function connectRedis(): Promise<void> {
  if (!RedisClient.isOpen) {
    await RedisClient.connect();
  }

  if (!Subscriber.isOpen) {
    await Subscriber.connect();
  }

  if (!Publisher.isOpen) {
    await Publisher.connect();
  }

  await deleteDeviceKeys();
  Logger.info('Redis connected successfully ✅');
}

function waitForMqtt(): Promise<void> {
  if (mqttClient.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onConnect = () => {
      cleanup();
      resolve();
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('MQTT connection timeout'));
    }, MQTT_CONNECT_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timer);
      mqttClient.off('connect', onConnect);
      mqttClient.off('error', onError);
    };

    mqttClient.once('connect', onConnect);
    mqttClient.once('error', onError);
  });
}

async function connectMqtt(): Promise<void> {
  await waitForMqtt();
  Logger.info('MQTT broker ready ✅');
}

export async function connectDependencies(): Promise<void> {
  await withStartupRetry('Database', connectDatabase);
  await withStartupRetry('Redis', connectRedis);
  await withStartupRetry('MQTT', connectMqtt);
}
