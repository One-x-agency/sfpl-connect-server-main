import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export const ValidationSchema = {};

interface DashboardStats {
  devices: number;
  projects: number;
  alerts: number;
  custom_notification_schemas: number;
}

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const customerId = req.user.id;

  const row = await db.queryOne<DashboardStats>(
    `
    WITH customer_devices AS (
      SELECT id
      FROM devices
      WHERE user_id = $1
    ),
    customer_notification_schemas AS (
      SELECT cns.id
      FROM custom_notification_schemas cns
      JOIN device_input_fields dif ON dif.id = cns.input_field_id
      JOIN customer_devices cd ON cd.id = dif.device_id
    ),
    customer_alert_notifications AS (
      SELECT n.id
      FROM notifications n
      LEFT JOIN LATERAL (
        SELECT
          CASE
            WHEN COALESCE(n.data->>'custom_notification_schema_id', n.meta_data->>'custom_notification_schema_id')::uuid IS NOT NULL
              THEN COALESCE(n.data->>'custom_notification_schema_id', n.meta_data->>'custom_notification_schema_id')::uuid
            ELSE NULL
          END AS custom_notification_schema_id
      ) resolved ON TRUE
      WHERE n.user_id = $1
        AND n.type = 'custom_notification'
        AND resolved.custom_notification_schema_id IN (
          SELECT id FROM customer_notification_schemas
        )
    )
    SELECT
      (SELECT COUNT(*)::int FROM customer_devices) AS devices,
      (SELECT COUNT(*)::int FROM projects WHERE user_id = $1) AS projects,
      (SELECT COUNT(*)::int FROM customer_alert_notifications) AS alerts,
      (SELECT COUNT(*)::int FROM customer_notification_schemas) AS custom_notification_schemas
    `,
    [customerId],
  );

  if (!row) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Failed to fetch dashboard stats',
    });
  }

  return res.status(StatusCodes.OK).json({
    data: {
      devices: row.devices ?? 0,
      projects: row.projects ?? 0,
      alerts: row.alerts ?? 0,
      custom_notification_schemas: row.custom_notification_schemas ?? 0,
    },
  });
}
