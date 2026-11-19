import type { NextFunction, Request, Response } from 'express';
import type { DatabaseClient } from '@/service/database/index.js';
import { HttpStatusCodes as StatusCodes } from '@/config/constant.js';

export const ValidationSchema = {};

interface ProjectRow {
  id: string;
  name: string;
  device_count: number;
}

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const projects = await db.queryAll<ProjectRow>(
    `
      SELECT
        p.id,
        p.name,
        COUNT(d.id)::int AS device_count
      FROM projects p
      LEFT JOIN devices d ON d.project_id = p.id
      GROUP BY p.id, p.name
      ORDER BY p.name ASC
    `,
  );

  const unassigned = await db.queryOne<{ device_count: number }>(
    `
      SELECT COUNT(*)::int AS device_count
      FROM devices
      WHERE project_id IS NULL
    `,
  );

  const projectSlices = (projects ?? [])
    .filter((p) => (p.device_count ?? 0) > 0)
    .map((p) => ({
      key: p.id,
      project_id: p.id,
      label: p.name,
      value: p.device_count ?? 0,
      tooltip: `${p.name}: ${p.device_count ?? 0} devices`,
    }));

  const unassignedCount = unassigned?.device_count ?? 0;
  const slices = [
    ...projectSlices,
    ...(unassignedCount > 0
      ? [
        {
          key: 'unassigned',
          project_id: null,
          label: 'Unassigned',
          value: unassignedCount,
          tooltip: `Unassigned: ${unassignedCount} devices`,
        },
      ]
      : []),
  ];

  const total_devices = slices.reduce((sum, s) => sum + (s.value ?? 0), 0);

  return res.status(StatusCodes.OK).json({
    data: {
      total_devices,
      slices,
    },
  });
}

