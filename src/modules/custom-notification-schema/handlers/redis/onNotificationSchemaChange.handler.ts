import { getDeviceFromCache } from '@/modules/device/services/deviceClass.service.js';
import database from '@/service/database/index.js';
import { Subscriber } from '@/service/redis/index.js';

const refreshDeviceCache = async (input_field_id: string) => {

  const existingInputField = await database.queryOne(`
    SELECT d.id, d.imei
    FROM device_input_fields dif
    LEFT JOIN devices d ON d.id = dif.device_id
    WHERE dif.id = $1
    LIMIT 1
  `, [input_field_id]);
  if (!existingInputField) return;

  if (!existingInputField.imei) return;

  const device = await getDeviceFromCache({}, existingInputField.imei);
  if (!device) return;

  await device.refreshCache();
};

Subscriber.subscribe('custom_notification_schema:created', async (message) => {
  const { input_field_id } = JSON.parse(message);
  await refreshDeviceCache(input_field_id);
});

Subscriber.subscribe('custom_notification_schema:updated', async (message) => {
  const { input_field_id } = JSON.parse(message);
  await refreshDeviceCache(input_field_id);
});

Subscriber.subscribe('custom_notification_schema:deleted', async (message) => {
  const { input_field_id } = JSON.parse(message);
  await refreshDeviceCache(input_field_id);
});
