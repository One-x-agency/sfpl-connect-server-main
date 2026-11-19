import z from 'zod';
import { device_io_pins } from '@/config/constant.js';


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

