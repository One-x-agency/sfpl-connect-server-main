import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import axios from 'axios';
import env from '@/config/env.js';

async function getDeviceMqttConnectionStatus(imei: string) {
  try {
    const response = await axios({
      method: 'GET',
      url: `http://${env.mqtt.host}:18083/api/v5/clients/${imei}`,
      auth: {
        username: env.emqx.apiKey,
        password: env.emqx.apiSecret,
      },
      headers: {
        'Content-Type': 'application/json',
      }
    });

    return response.data;

  }catch (error) {
    if (error.response.status === 404) {
      return { connected: false };
    }
    throw error;
  }
}

export const ValidationSchema = {
  params: z.object({
    id: z.uuid({ version: 'v7', message: 'Invalid UUID' }),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;

  // fetch device info, project name, sim card number, user name in 1 go via LEFT JOINs
  const device = await db.queryOne(`
    SELECT
      d.id,
      d.imei,
      d.project_id,
      d.name,
      d.description,
      d.sim_card_id,
      d.latitude,
      d.longitude,
      d.user_id,
      d.firmware_version,
      d.meta_data,
      d.order_id,
      d.serial_number,
      d.serial,
      d.batch_number,
      d.created_at,
      d.updated_at,
      p.name AS project_name,
      s.number AS sim_card_number,
      u.name AS user_name,
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
    FROM devices d
    LEFT JOIN projects p ON d.project_id = p.id
    LEFT JOIN sim_cards s ON d.sim_card_id = s.id
    LEFT JOIN users u ON d.user_id = u.id
    LEFT JOIN connect_store_orders o ON o.id = d.order_id
    LEFT JOIN (
      SELECT
        DISTINCT ON (device_id) device_id,
        timestamp,
        status,
        data,
        created_at
      FROM device_logs
      ORDER BY device_id, timestamp DESC, created_at DESC
    ) dl ON dl.device_id = d.id
    WHERE d.id = $1
  `, [id]);

  if (!device) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });
  }

  if (req.user?.role === 'qc' && device.user_id) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });
  }

  const mqttConnectionStatus = await getDeviceMqttConnectionStatus(device.imei);

  device.is_online = mqttConnectionStatus.connected;

  return res.status(StatusCodes.OK).json(device);
}
