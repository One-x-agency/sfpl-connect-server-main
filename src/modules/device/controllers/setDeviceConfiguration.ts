import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import env from '@/config/env.js';
import { findDeviceById } from '@/modules/device/device.service.js';
import { publishTopic } from '@/mqttClient.js';
import { logActivity, getActivityActorFromRequest } from '@/modules/activity-log/services/activity-log.service.js';
import { denyQcAssigned } from '@/modules/device/device-qc-access.js';

const bodySchema = z.object({
  url: z.string().trim().optional(),
  refresh_rate_1: z.coerce.number(),
  refresh_rate_2: z.coerce.number(),
  thr_a: z.coerce.number(),
  thr_v: z.coerce.number(),
  thr_i: z.coerce.number(),
  password: z.string().trim().min(1, 'Password is required'),
});

export const ValidationSchema = {
  params: z.object({
    id: z.uuid({ version: 'v7', message: 'Invalid UUID' }),
  }),
  body: bodySchema,
};

const CONFIGURATION_ACK_TIMEOUT_MS = 10000;


export async function Controller(req: Request, res: Response, _next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const body = req.body as z.infer<typeof bodySchema>;

  const device = await findDeviceById({ database: db }, id);

  if (!device) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });
  }

  if (denyQcAssigned(res, req.user?.role, device.user_id)) {
    return undefined;
  }

  const resolvedUrl = body.url ?? env.deviceConfigurationUrl;

  if (!resolvedUrl) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Configuration URL is required either in request body or DEVICE_CONFIGURATION_URL env',
    });
  }

  const payload = {
    url: resolvedUrl,
    refresh_rate_1: body.refresh_rate_1,
    refresh_rate_2: body.refresh_rate_2,
    thr_a: body.thr_a,
    thr_v: body.thr_v,
    thr_i: body.thr_i,
    password: body.password,
  };

  const ackPayload = await publishTopic(`device/${device.imei}/configuration/set`, payload, {
    timeout: CONFIGURATION_ACK_TIMEOUT_MS,
    ackTopic: `device/${device.imei}/configuration/ack`,
  });

  if (!ackPayload) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Configuration unacknowledged',
      imei: device.imei,
      timeout_ms: CONFIGURATION_ACK_TIMEOUT_MS,
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
        jsonb_set(meta_data, '{last_acknowledged_configuration}', $2::jsonb),
        '{last_acknowledged_configuration_at}',
        to_jsonb($3::text)
      ),
      updated_at = now()
    WHERE imei = $1
    RETURNING id, imei, meta_data, updated_at
  `, [device.imei, data, new Date().toISOString()]);

  await logActivity(db, {
    ...getActivityActorFromRequest(req),
    module: 'devices',
    action: 'set_configuration',
    entityId: device.id,
    entityLabel: device.name || device.imei,
    metadata: {
      refresh_rate_1: body.refresh_rate_1,
      refresh_rate_2: body.refresh_rate_2,
      thr_a: body.thr_a,
      thr_v: body.thr_v,
      thr_i: body.thr_i,
    },
  });

  return res.status(StatusCodes.OK).json(data);
}
