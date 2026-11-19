import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { getPresignedDownloadUrl } from '@/service/aws/index.js';
import { getDeviceLogArchiveForAdmin } from '@/modules/device/services/deviceLogArchive.service.js';

const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'year_month must be YYYY-MM');

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
    year_month: yearMonthSchema,
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id: deviceId, year_month: yearMonth } = req.params as z.infer<typeof ValidationSchema.params>;

  const archive = await getDeviceLogArchiveForAdmin(db, deviceId, yearMonth);
  if (!archive) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Archive not found' });
  }

  const url = await getPresignedDownloadUrl(archive.s3_bucket, archive.s3_key);

  return res.status(StatusCodes.OK).json({
    data: {
      url,
      expires_in: 900,
      year_month: archive.year_month,
      s3_key: archive.s3_key,
    },
  });
}
