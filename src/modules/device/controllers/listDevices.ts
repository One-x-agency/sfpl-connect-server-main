import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import env from '@/config/env.js';
import axios from 'axios';
import qs from 'qs';

async function getDevicesMqttConnectionStatus(imeis: string[]) {
  if (!imeis.length) return [];

  const response = await axios({
    method: 'GET',
    url: `http://${env.mqtt.host}:18083/api/v5/clients`,
    auth: {
      username: env.emqx.apiKey,
      password: env.emqx.apiSecret,
    },
    headers: {
      'Content-Type': 'application/json',
    },
    params: {
      clientid: imeis,
      fields: 'connected,clientid',
    },
    // EMQX expects repeated query keys (clientid=a&clientid=b), not clientid[]=a&clientid[]=b.
    paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
  });

  return response.data?.data || [];
}

export const ValidationSchema = {
  query: z.object({
    limit: Schema.pagination.limit(),
    offset: Schema.pagination.offset(),
    search: z.string().trim().optional(),
    project_id: Schema.uuid().optional(),
    // Empty string must not hit Schema.uuid ("Invalid UUID"); treat as omitted.
    user_id: z.preprocess(
      (value) => (value === '' || value === null || value === undefined ? undefined : value),
      Schema.uuid().optional(),
    ),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const {
    limit,
    offset,
    search,
    project_id,
    user_id,
  } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;

  const devices = await db.namedQueryAll(
    `
    WITH filtered_devices AS (
      SELECT
        id,
        imei,
        project_id,
        name,
        description,
        sim_card_id,
        latitude,
        longitude,
        user_id,
        firmware_version,
        meta_data,
        order_id,
        serial_number,
        serial,
        batch_number,
        created_at
      FROM devices
      WHERE TRUE
        AND ($search::text IS NULL OR imei ILIKE $search OR name ILIKE $search OR serial ILIKE $search OR batch_number ILIKE $search)
        AND ($user_id::uuid IS NULL OR user_id = $user_id)
        AND ($project_id::uuid IS NULL OR project_id = $project_id)
        AND (NOT $qc_unassigned_only::boolean OR user_id IS NULL)
      ORDER BY created_at DESC
      LIMIT $limit
      OFFSET $offset
    )

    SELECT
      d.*,
      sc.number AS sim_card_name,
      sc.number AS sim_card_number,
      o.serial AS order_serial,

      CASE WHEN dl.device_id IS NOT NULL THEN
        json_build_object(
          'timestamp', dl.timestamp,
          'status', dl.status,
          'data', dl.data
        )
      ELSE NULL END AS last_record,

      CASE
        WHEN dl.device_id IS NOT NULL AND dl.timestamp >= NOW() - INTERVAL '10 minutes' THEN dl.status
        ELSE 'inactive'
      END AS status

    FROM filtered_devices d
    LEFT JOIN sim_cards sc ON sc.id = d.sim_card_id
    LEFT JOIN connect_store_orders o ON o.id = d.order_id
    LEFT JOIN LATERAL (
      SELECT
        device_id,
        timestamp,
        status,
        data,
        created_at
      FROM device_logs
      WHERE device_id = d.id
      ORDER BY timestamp DESC, created_at DESC
      LIMIT 1
    ) dl ON dl.device_id = d.id
    `,
    {
      limit,
      offset,
      search: search ? `%${search}%` : null,
      user_id: user_id ?? null,
      project_id: project_id ?? null,
      qc_unassigned_only: req.user?.role === 'qc',
    },
  );

  const mqttConnectionStatus = await getDevicesMqttConnectionStatus(devices.map(device => device.imei));

  devices.forEach(device => {
    device.is_online = mqttConnectionStatus.find(status => status.clientid === device.imei)?.connected;
  });

  return res.status(StatusCodes.OK).json(devices);
}

