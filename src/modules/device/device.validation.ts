import z from 'zod';
import { device_io_pins } from '@/config/constant.js';

const ALLOWED_IO_PIN_SET = new Set<string>(device_io_pins);

/** One calibration scalar: JSON number, or numeric string. Avoids `z.coerce.number()` on `undefined` -> NaN ("received NaN"). */
const singleCalibrationValueSchema = z.union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : Number(v)))
  .refine((n) => Number.isFinite(n), { message: 'Calibration value must be a finite number' });

/** HTTP body / MQTT set: exactly one key from `device_io_pins`, value is numeric. */
export const singlePinCalibrationRecordSchema = z.record(z.string(), singleCalibrationValueSchema)
  .superRefine((obj, ctx) => {
    const keys = Object.keys(obj);
    if (keys.length !== 1) {
      ctx.addIssue('Exactly one IO pin key is required (no more than one)');
      return;
    }
    const pin = keys[0];
    if (!ALLOWED_IO_PIN_SET.has(pin)) {
      ctx.addIssue(`Invalid pin "${pin}". Allowed: ${device_io_pins.join(', ')}`);
    }
  });

export type SinglePinCalibrationRecord = z.infer<typeof singlePinCalibrationRecordSchema>;


export default {
  calibration: () =>z.array(z.object(
    {
      voltage: z.number(),
      value: z.number(),
    }
  )).default([]).refine((data) => data.length === 0 || data.length > 1, {
    message: 'Calibration must be an array with at least two points.',
  }),

  validation: () => z
    .object({
      operator: z.enum(['<', '>', '<=', '>=', '=', '!=']),
      value: z.number(),
    }),

  io_pin: () => z.enum(device_io_pins),
};

