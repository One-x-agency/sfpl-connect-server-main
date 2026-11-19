import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { STAFF_ROLES } from '@/constants/user-role.js';

export const ValidationSchema = {};

interface DashboardStats {
  devices: number;
  projects: number;
  customers: number;
  sim_cards: number;
  sim_plans: number;
  users: number;
  files: number;
  notifications: number;
  active_sim_cards: number;
  devices_with_sim: number;
  custom_notification_schemas: number;
}

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const row = await db.queryOne<DashboardStats>(
    `
    SELECT
      (SELECT COUNT(*)::int FROM devices) AS devices,
      (SELECT COUNT(*)::int FROM projects) AS projects,
      (SELECT COUNT(*)::int FROM users WHERE role = 'customer' AND is_deleted = false) AS customers,
      (SELECT COUNT(*)::int FROM sim_cards) AS sim_cards,
      (SELECT COUNT(*)::int FROM sim_plans) AS sim_plans,
      (SELECT COUNT(*)::int FROM users WHERE role = ANY($1::user_role[]) AND is_deleted = false) AS users,
      (SELECT COUNT(*)::int FROM files) AS files,
      (SELECT COUNT(*)::int FROM notifications) AS notifications,
      (SELECT COUNT(*)::int FROM sim_cards WHERE is_active = true) AS active_sim_cards,
      (SELECT COUNT(*)::int FROM devices WHERE sim_card_id IS NOT NULL) AS devices_with_sim,
      (SELECT COUNT(*)::int FROM custom_notification_schemas) AS custom_notification_schemas
    `,
    [STAFF_ROLES],
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
      customers: row.customers ?? 0,
      sim_cards: row.sim_cards ?? 0,
      sim_plans: row.sim_plans ?? 0,
      users: row.users ?? 0,
      files: row.files ?? 0,
      notifications: row.notifications ?? 0,
      active_sim_cards: row.active_sim_cards ?? 0,
      devices_with_sim: row.devices_with_sim ?? 0,
      custom_notification_schemas: row.custom_notification_schemas ?? 0,
    },
  });
}
