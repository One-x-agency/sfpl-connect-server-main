import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';

const ACTIVITY_ACTIONS = [
  'create',
  'update',
  'delete',
  'status_change',
  'activate',
  'deactivate',
  'otp_sent',
  'otp_verified',
  'login',
  'set_configuration',
  'set_calibration',
] as const;

const TRACKED_MODULES = [
  'users',
  'devices',
  'device_input_fields',
  'sim_plans',
  'sim_cards',
  'connect_store_devices',
  'connect_store_orders',
] as const;

export const ValidationSchema = {
  query: z.object({
    limit: Schema.pagination.limit(),
    offset: Schema.pagination.offset(),
    search: z.string().trim().min(1).optional(),
    module: z.enum(TRACKED_MODULES).optional(),
    action: z.enum(ACTIVITY_ACTIONS).optional(),
    user_id: Schema.uuid().optional(),
    entity_id: Schema.uuid().optional(),
    from_date: z.string().datetime({ offset: true }).optional(),
    to_date: z.string().datetime({ offset: true }).optional(),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const query = req.validatedQuery as z.infer<typeof ValidationSchema.query>;
  const {
    limit,
    offset,
    search,
    module,
    action,
    user_id: userId,
    entity_id: entityId,
    from_date: fromDate,
    to_date: toDate,
  } = query;

  const queryParams: Record<string, unknown> = { limit, offset };
  const conditions: string[] = [];

  if (search) {
    queryParams.search = `%${search}%`;
    conditions.push(`(
      al.entity_label ILIKE $search
      OR u.name ILIKE $search
      OR u.email ILIKE $search
    )`);
  }

  if (module) {
    queryParams.module = module;
    conditions.push('al.module = $module');
  }

  if (action) {
    queryParams.action = action;
    conditions.push('al.action = $action::activity_action');
  }

  if (userId) {
    queryParams.user_id = userId;
    conditions.push('al.user_id = $user_id');
  }

  if (entityId) {
    queryParams.entity_id = entityId;
    conditions.push('al.entity_id = $entity_id');
  }

  if (fromDate) {
    queryParams.from_date = fromDate;
    conditions.push('al.created_at >= $from_date::timestamptz');
  }

  if (toDate) {
    queryParams.to_date = toDate;
    conditions.push('al.created_at <= $to_date::timestamptz');
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const logs = await db.namedQueryAll(
    `
      SELECT
        al.id,
        al.user_id,
        u.name AS user_name,
        u.email AS user_email,
        u.role::text AS user_role,
        al.module,
        al.action::text AS action,
        al.entity_id,
        al.entity_label,
        al.changes,
        al.metadata,
        al.ip_address,
        al.created_at
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $limit
      OFFSET $offset
    `,
    queryParams,
  );

  return res.status(StatusCodes.OK).json({ data: logs });
}
