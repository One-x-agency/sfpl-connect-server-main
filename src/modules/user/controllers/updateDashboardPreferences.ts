import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import z from 'zod';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';
import Schema from '@/config/validationSchema.js';
import { updateDashboardPreferences } from '@/modules/user/user.service.js';

const MAX_PREFERENCES_BYTES = 100 * 1024;

const layoutItemSchema = Schema.dashboardPreferences.layoutItem();
const widgetSchema = z.object({
  id: z.string().trim().min(1).max(100),
  type: z.enum(Schema.dashboardPreferences.widgetTypes),
  title: z.string().trim().min(1).max(255),
  visible: z.boolean(),
  props: z.record(z.string(), z.unknown()).optional().default({}),
});

export const ValidationSchema = {
  query: z.object({
    page: Schema.dashboardPreferences.page().default('overview'),
  }),
  body: z.object({
    version: z.number().int().min(1),
    widgets: z.array(widgetSchema).min(1),
    layouts: z.object({
      lg: z.array(layoutItemSchema),
      md: z.array(layoutItemSchema),
      sm: z.array(layoutItemSchema),
    }),
    updated_at: z.string().optional(),
  })
    .refine((body) => {
      const widgetIds = body.widgets.map((widget) => widget.id);
      return new Set(widgetIds).size === widgetIds.length;
    }, {
      message: 'Widget ids must be unique',
      path: ['widgets'],
    })
    .superRefine((body, ctx) => {
      const widgetIds = new Set(body.widgets.map((widget) => widget.id));

      (['lg', 'md', 'sm'] as const).forEach((breakpoint) => {
        body.layouts[breakpoint].forEach((item, index) => {
          if (!widgetIds.has(item.i)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['layouts', breakpoint, index, 'i'],
              message: 'Layout item i must match a widget id',
            });
          }
        });
      });
    })
    .refine((body) => Buffer.byteLength(JSON.stringify(body), 'utf8') <= MAX_PREFERENCES_BYTES, {
      message: 'Dashboard preferences payload exceeds 100KB',
    }),
};

export async function Controller(req: Request, res: Response, next: NextFunction, db: DatabaseClient) {
  const { page } = req.validatedQuery as z.infer<typeof ValidationSchema.query>;
  const body = req.body as z.infer<typeof ValidationSchema.body>;
  const userId = req.user!.id;

  const preference = await updateDashboardPreferences(
    { database: db },
    userId,
    page,
    body,
  );

  return res.status(StatusCodes.OK).json({
    data: preference,
  });
}
