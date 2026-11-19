import type { Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

const isQcOnCustomerDevice = (role?: string | null, userId?: string | null) =>
  role === 'qc' && userId != null && userId !== '';

export function denyQcAssigned(
  res: Response,
  role?: string | null,
  userId?: string | null,
): boolean {
  if (!isQcOnCustomerDevice(role, userId)) return false;

  res.status(StatusCodes.FORBIDDEN).json({
    code: 'forbidden',
    message: 'QC users cannot modify devices assigned to a customer',
  });
  return true;
}

export async function getInputFieldDeviceUserId(db: DatabaseClient, inputFieldId: string) {
  return db.queryOne<{ user_id: string | null }>(
    'SELECT d.user_id FROM devices d JOIN device_input_fields dif ON dif.device_id = d.id WHERE dif.id = $1',
    [inputFieldId],
  );
}
