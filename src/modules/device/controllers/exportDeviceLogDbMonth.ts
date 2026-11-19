import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import {
  deviceExists,
  getDeviceNameAndImei,
  isDeviceLogMonthArchived,
} from '@/modules/device/services/deviceLogArchive.service.js';
import env from '@/config/env.js';
import {
  archiveDeviceLogCsvHeaderLine,
  archiveDeviceLogRowToCsvLine,
} from '@/modules/device/utils/archiveDeviceLogCsv.js';
import {
  buildDbLogExportFileName,
  iterateDeviceLogMonthBatches,
} from '@/modules/device/services/deviceLogDbExport.service.js';

const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'year_month must be YYYY-MM');

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
    year_month: yearMonthSchema,
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id: deviceId, year_month: yearMonth } = req.params as z.infer<typeof ValidationSchema.params>;

  const exists = await deviceExists(db, deviceId);
  if (!exists) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });
  }

  const device = await getDeviceNameAndImei(db, deviceId);
  if (!device) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Device not found' });
  }

  const archived = await isDeviceLogMonthArchived(db, deviceId, yearMonth);
  if (archived) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'This month is archived on S3. Use Monthly backups download.',
    });
  }

  const countRow = await db.namedQueryOne<{ count: number }>(
    `
    SELECT COUNT(*)::int AS count
    FROM device_logs dl
    WHERE dl.device_id = $device_id::uuid
      AND to_char(date_trunc('month', dl.timestamp AT TIME ZONE $tz), 'YYYY-MM') = $year_month
    `,
    {
      device_id: deviceId,
      year_month: yearMonth,
      tz: env.deviceLogArchive.tz || 'UTC',
    },
  );

  if (!countRow?.count) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'No logs found for this month' });
  }

  const fileName = buildDbLogExportFileName(device.name, device.imei, yearMonth);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.write(archiveDeviceLogCsvHeaderLine());

  for await (const batch of iterateDeviceLogMonthBatches(db, deviceId, yearMonth)) {
    for (const row of batch) {
      res.write(`${archiveDeviceLogRowToCsvLine(row)}\n`);
    }
  }

  return res.end();
}
