import { Subscriber } from '@/service/redis/index.js';
import database from '@/service/database/index.js';
import { getDeviceFromCache } from '@/modules/device/services/deviceClass.service.js';

const refreshDeviceCache = async (device_id: string) => {
  const existingDevice = await database.queryOne('SELECT imei FROM devices WHERE id = $1', [device_id]);
  if (!existingDevice) return;

  const device = await getDeviceFromCache({}, existingDevice.imei);
  if (!device) return;

  await device.refreshCache();
};

Subscriber.subscribe('device:input_field:created', async (message) => {
  const { device_id } = JSON.parse(message);
  await refreshDeviceCache(device_id);
});

Subscriber.subscribe('device:input_field:updated', async (message) => {
  const { device_id } = JSON.parse(message);
  await refreshDeviceCache(device_id);
});

Subscriber.subscribe('device:input_field:deleted', async (message) => {
  const { device_id } = JSON.parse(message);
  await refreshDeviceCache(device_id);
});
