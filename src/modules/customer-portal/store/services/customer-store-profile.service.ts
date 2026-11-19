import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import Schema from '@/config/validationSchema.js';

const PAN_NUMBER_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_NUMBER_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const optionalGstNumber = z
  .string()
  .trim()
  .toUpperCase()
  .max(15)
  .optional()
  .or(z.literal(''))
  .refine((value) => !value || GST_NUMBER_REGEX.test(value), 'Invalid GST number');

const optionalPanNumber = z
  .string()
  .trim()
  .toUpperCase()
  .max(10)
  .optional()
  .or(z.literal(''))
  .refine((value) => !value || PAN_NUMBER_REGEX.test(value), 'Invalid PAN number');

export const storeCustomerProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(255),
  phone_number: Schema.phoneNumber(),
  organization_name: z.string().trim().max(255).optional().or(z.literal('')),
  gst_number: optionalGstNumber,
  pan_number: optionalPanNumber,
});

export type StoreCustomerProfileInput = z.infer<typeof storeCustomerProfileSchema>;

export async function getCustomerStoreProfile(db: DatabaseClient, customerId: string) {
  const profile = await db.queryOne(
    `SELECT
      u.email,
      u.name AS full_name,
      u.phone_number,
      COALESCE(u.organization_name, '') AS organization_name,
      COALESCE(u.gst_number, '') AS gst_number,
      COALESCE(u.pan_number, '') AS pan_number
     FROM users u
     WHERE u.id = $1
       AND u.role = 'customer'
       AND u.is_deleted = false`,
    [customerId],
  );

  return profile;
}

export async function updateCustomerStoreProfile(
  db: DatabaseClient,
  customerId: string,
  body: StoreCustomerProfileInput,
) {
  const profile = await db.queryOne(
    `UPDATE users
     SET
       name = $1,
       phone_number = $2,
       organization_name = $3,
       gst_number = $4,
       pan_number = $5,
       updated_at = NOW()
     WHERE id = $6
       AND role = 'customer'
       AND is_deleted = false
     RETURNING
       name AS full_name,
       phone_number,
       COALESCE(organization_name, '') AS organization_name,
       COALESCE(gst_number, '') AS gst_number,
       COALESCE(pan_number, '') AS pan_number`,
    [
      body.full_name,
      body.phone_number,
      body.organization_name?.trim() || null,
      body.gst_number?.trim().toUpperCase() || null,
      body.pan_number?.trim().toUpperCase() || null,
      customerId,
    ],
  );

  return profile;
}
