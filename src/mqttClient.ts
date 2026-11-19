import mqtt from 'mqtt';
import Logger from '@/service/logger/index.js';
import Handler from '@/modules/receiver/controllers/handleMQTTRecordFormate1.js';
import env from '@/config/env.js';

import Socket from '@/socket.js';
import ServerError from '@/core/serverError.class.js';

const mqttClient = mqtt.connect(`mqtt://${env.mqtt.host}:${env.mqtt.port}`, {
  clientId: env.mqtt.clientId,
  username: env.mqtt.username,
  password: env.mqtt.password,
  keepalive: 600,
});

const DEFAULT_ACK_TIMEOUT_MS = 10000;

function subscribeToTopic(topic: string) {
  mqttClient.subscribe(topic, (error) => {
    if (error) {
      Logger.error(`Skipping optional MQTT topic ${topic}: ${error.message}`);
    }
  });
}

const pendingPublishedTopics = new Map<
string,
{
  resolve: (payload: any) => void;
  reject: (error: Error) => void;
  timeoutHandle: NodeJS.Timeout;
}
>();

mqttClient.on('connect', () => {
  Logger.info('Connected to MQTT broker ✅');
  subscribeToTopic('device/+/data');
  subscribeToTopic('device/+/configuration');
  subscribeToTopic('device/+/configuration/ack');
  subscribeToTopic('device/+/calibration/ack');
  subscribeToTopic('$SYS/brokers/+/clients/+/connected');
  subscribeToTopic('$SYS/brokers/+/clients/+/disconnected');
});

mqttClient.on('message', async (topic, message) => {

  const parts = topic.split('/');

  if (parts[0] === 'device') {
    if (parts[2] === 'data') {
      try {
        await Handler(JSON.parse(message.toString()));
      } catch (error) {
        Logger.error('Error parsing message:', error);
      }
      return;
    }

    if ((parts[2] === 'configuration' || parts[2] === 'calibration') && parts[3] === 'ack') {

      try {
        const imei = parts[1];

        const pending = pendingPublishedTopics.get(topic);

        if (!pending) {
          Logger.warn(`No pending ${parts[2]} ACK request for imei ${imei}`);
          return;
        }

        clearTimeout(pending.timeoutHandle);
        pendingPublishedTopics.delete(topic);
        pending.resolve(message.toString());

      } catch (error) {
        Logger.error('Error handling device/configuration/ack:', error);
      }
    }
  } else if (parts[0] === '$SYS') {

    if (topic.endsWith('/connected')) {
      const data = JSON.parse(message.toString());
      Socket.io?.to(data.clientid).emit('mqtt:device/connected', { imei: data.clientid });
    }

    if (topic.endsWith('/disconnected')) {
      const data = JSON.parse(message.toString());
      Socket.io?.to(data.clientid).emit('mqtt:device/disconnected', { imei: data.clientid });
    }
  }

});

mqttClient.on('error', (error) => {
  Logger.error(`MQTT error: ${error.message}`);
});

mqttClient.on('close', (error?: Error | null) => {
  Logger.info('MQTT connection closed ❌', error ? error.message : 'Unknown error');
});

export function publishTopic(topic: string, payload: any, options: { timeout?: number, ackTopic?: string } = {}): Promise<any> {
  const timeout = options.timeout ?? DEFAULT_ACK_TIMEOUT_MS;
  const ackTopic = options.ackTopic;
  const previousPending = pendingPublishedTopics.get(ackTopic);

  if (previousPending) {
    throw new ServerError(`Pending publication request for topic ${ackTopic} already exists`);
  }

  return new Promise<void>((resolve, reject) => {

    const timeoutHandle = setTimeout(() => {
      pendingPublishedTopics.delete(ackTopic);
      reject(new ServerError(`Timeout waiting for ACK on topic ${ackTopic}`));
    }, timeout);

    pendingPublishedTopics.set(ackTopic, {
      timeoutHandle,
      resolve,
      reject,
    });

    mqttClient.publish(topic, JSON.stringify(payload), {
      qos: 2,
    }, (error : Error | null) => {
      if (error) {
        clearTimeout(timeoutHandle);
        pendingPublishedTopics.delete(ackTopic);
        reject(error instanceof Error ? error : new ServerError('Failed to publish MQTT message'));
      }
    });

  });

}


export default mqttClient;
