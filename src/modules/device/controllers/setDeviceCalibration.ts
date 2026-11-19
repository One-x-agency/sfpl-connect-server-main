import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { findDeviceById } from '@/modules/device/device.service.js';
import { publishTopic } from '@/mqttClient.js';
import { singlePinCalibrationRecordSchema } from '@/modules/device/device.validation.js';
import { logActivity, getActivityActorFromRequest } from '@/modules/activity-log/services/activity-log.service.js';
import { denyQcAssigned } from '@/modules/device/device-qc-access.js';

const CALIBRATION_ACK_TIMEOUT_MS = 10000;

export const ValidationSchema = {
  params: z.object({
    id: z.uuid({ version: 'v7', message: 'Invalid UUID' }),
  }),
  body: singlePinCalibrationRecordSchema,
};

export async function Controller(req: Request, res: Response, _next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const payload = req.body as z.infer<typeof singlePinCalibrationRecordSchema>;

  const device = await findDeviceById({ database: db }, id);
  if (!device) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });
  }

  if (denyQcAssigned(res, req.user?.role, device.user_id)) {
    return undefined;
  }

  const ackPayload = await publishTopic(`device/${device.imei}/calibration/set`, payload, {
    timeout: CALIBRATION_ACK_TIMEOUT_MS,
    ackTopic: `device/${device.imei}/calibration/ack`,
  });

  if (!ackPayload) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Calibration unacknowledged',
      imei: device.imei,
      timeout_ms: CALIBRATION_ACK_TIMEOUT_MS,
    });
  }

  const data = JSON.parse(ackPayload);

  if (typeof data !== 'object' || data === null) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Invalid ACK payload',
    });
  }

  db.queryOne(`
    UPDATE devices
    SET
      meta_data = jsonb_set(
        jsonb_set(meta_data, '{last_acknowledged_calibration}', $2::jsonb),
        '{last_acknowledged_calibration_at}',
        to_jsonb($3::text)
      ),
      updated_at = now()
    WHERE imei = $1
    RETURNING id, imei, meta_data, updated_at
  `, [device.imei, data, new Date().toISOString()]);

  const [pin, value] = Object.entries(payload)[0] ?? [];

  await logActivity(db, {
    ...getActivityActorFromRequest(req),
    module: 'devices',
    action: 'set_calibration',
    entityId: device.id,
    entityLabel: device.name || device.imei,
    metadata: {
      pin,
      value,
    },
  });

  return res.status(StatusCodes.OK).json(data);
}
