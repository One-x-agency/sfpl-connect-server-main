import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import { updateConnectStoreDevice } from '@/modules/connect-store-device/services/connect-store-device.service.js';
import Schema from '@/config/validationSchema.js';

const hsnSacSchema = z.string().trim().regex(/^\d{4,8}$/, 'HSN/SAC must be 4 to 8 digits');

export const ValidationSchema = {
  params: z.object({
    id: Schema.uuid(),
  }),
  body: z.object({
    name: z.string().trim().min(2).max(255).optional(),
    short_description: z.string().trim().max(500).nullable().optional(),
    description_md: z.string().trim().nullable().optional(),
    hsn_sac: hsnSacSchema,
    price_in_rupee: z.number().min(0).max(100000000).optional(),
    connect_count: z.number().int().min(1).max(10000).optional(),
    image_id: z.uuid({ version: 'v7' }).nullable().optional(),
    in_stock: z.boolean().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { id } = req.params as z.infer<typeof ValidationSchema.params>;
  const body = req.body as z.infer<typeof ValidationSchema.body>;
  const device = await updateConnectStoreDevice(db, id, {
    ...body,
    updated_by: req.user?.id,
  });
  return res.status(StatusCodes.OK).json({ data: device });
}
