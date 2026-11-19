import type { Request } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';

export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'activate'
  | 'deactivate'
  | 'otp_sent'
  | 'otp_verified'
  | 'login'
  | 'set_configuration'
  | 'set_calibration';

export type LogActivityParams = {
  userId?: string | null;
  module: string;
  action: ActivityAction;
  entityId: string;
  entityLabel?: string | null;
  changes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

export async function logActivity(db: DatabaseClient, params: LogActivityParams) {
  await db.queryOne(
    `SELECT insert_activity_log($1, $2, $3::activity_action, $4, $5, $6::jsonb, $7::jsonb, $8)`,
    [
      params.userId ?? null,
      params.module,
      params.action,
      params.entityId,
      params.entityLabel ?? null,
      params.changes ? JSON.stringify(params.changes) : null,
      JSON.stringify(params.metadata ?? {}),
      params.ipAddress ?? null,
    ],
  );
}

export function getActivityActorFromRequest(req: Request) {
  return {
    userId: req.user?.id ?? null,
    ipAddress: req.ip || req.socket?.remoteAddress || null,
  };
}

export async function logConnectStoreOrderActivity(
  db: DatabaseClient,
  req: Request,
  params: {
    orderId: string;
    orderSerial?: string | null;
    action: ActivityAction;
    metadata?: Record<string, unknown>;
    changes?: Record<string, unknown> | null;
  },
) {
  await logActivity(db, {
    ...getActivityActorFromRequest(req),
    module: 'connect_store_orders',
    action: params.action,
    entityId: params.orderId,
    entityLabel: params.orderSerial ?? params.orderId,
    metadata: params.metadata,
    changes: params.changes,
  });
}
