import RedisClient from '@/service/redis/index.js';
import type { Context as ServiceContext } from '@/core/registerService.js';
import Device, { type DeviceInput } from '@/modules/device/device.class.js';
import RegisterService from '@/core/registerService.js';

async function getDeviceFromDBService(ctx: ServiceContext, imei: string):
Promise<Device | null> {
  const device = await ctx.database.queryOne(
    `
    WITH
      input_fields_with_notification_schemas AS (
        SELECT
          dif.*,
          COALESCE(array_agg(jsonb_build_object(
            'id', cns.id,
            'name', cns.name,
            'description', cns.description,
            'operator', cns.operator,
            'value', cns.value,
            'send_to_email', cns.send_to_email,
            'send_to_sms', cns.send_to_sms
          )) FILTER (WHERE cns.id IS NOT NULL), '{}'::jsonb[]) as custom_notification_schemas
        FROM device_input_fields dif
        LEFT JOIN custom_notification_schemas cns ON cns.input_field_id = dif.id
        GROUP BY dif.id
      )

      SELECT
        d.id,
        d.user_id,
        d.imei,
        array_agg(
          jsonb_build_object(
            'id', dif.id,
            'io_pin', dif.io_pin,
            'name', dif.name,
            'conversation_factor', dif.conversation_factor,
            'calibration', dif.calibration,
            'validation', dif.validation,
            'unit', dif.unit,
            'priority', dif.priority,
            'custom_notification_schemas', dif.custom_notification_schemas
          )
        ) as input_fields

      FROM devices d
      LEFT JOIN input_fields_with_notification_schemas dif ON dif.device_id = d.id
      WHERE d.imei = $1
      GROUP BY d.id, d.imei
    `,
    [imei],
  );

  if (!device) return null;

  return new Device(device as DeviceInput);
}

async function getDeviceFromCacheService(ctx: ServiceContext, imei: string): Promise<Device | null> {
  const device = await RedisClient.json.get(`device:imei:${imei}`);
  if (!device) return null;
  return new Device(device as DeviceInput);
}

async function fetchDeviceByImeiService(ctx: ServiceContext, imei: string) {
  let device = await getDeviceFromCacheService(ctx, imei);
  if (!device) {
    device = await getDeviceFromDBService(ctx, imei);
    if (!device) return null;
  }
  return device;
}


export const fetchDeviceByImei = RegisterService(fetchDeviceByImeiService);
export const getDeviceFromDB = RegisterService(getDeviceFromDBService);
export const getDeviceFromCache = RegisterService(getDeviceFromCacheService);
