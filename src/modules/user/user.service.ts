import type { Context as ServiceContext } from '@/core/registerService.js';
import RegisterService from '@/core/registerService.js';
import ServerError from '@/core/serverError.class.js';
import { createOverviewDashboardPreference } from '@/modules/user/dashboardPreferences.defaults.js';

export interface DashboardLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface DashboardWidget {
  id: string;
  type:
  | 'environment-stats'
  | 'device-locations-map'
  | 'pin-history'
  | 'device-status-pie'
  | 'status-heatmap'
  | 'project-device-pie'
  | 'unread-alerts-list';
  visible: boolean;
  props: Record<string, unknown>;
  title?: string;
}

export interface DashboardPreference {
  version: number;
  widgets: DashboardWidget[];
  layouts: {
    lg: DashboardLayoutItem[];
    md: DashboardLayoutItem[];
    sm: DashboardLayoutItem[];
  };
  updated_at: string;
}

type DashboardPage = 'overview';
type UserMetadata = Record<string, unknown>;

function createDefaultDashboardPreference(page: DashboardPage): DashboardPreference {
  const preference: Record<DashboardPage, DashboardPreference> = {
    overview: createOverviewDashboardPreference(),
  };

  return preference[page];
}

async function getDashboardPreferencesService(
  ctx: ServiceContext,
  userId: string,
  page: DashboardPage,
) {
  const db = ctx.database!;

  const user = await db.queryOne<{ metadata: UserMetadata | null }>(
    'SELECT metadata FROM users WHERE id = $1',
    [userId],
  );

  if (!user) throw new ServerError('User not found');

  const dashboard = user.metadata?.dashboard as Record<string, DashboardPreference> | undefined;
  const stored = dashboard?.[page];
  if (!stored) return createDefaultDashboardPreference(page);

  return stored as DashboardPreference;
}

async function updateDashboardPreferencesService(
  ctx: ServiceContext,
  userId: string,
  page: DashboardPage,
  preference: Omit<DashboardPreference, 'updated_at'> & { updated_at?: string },
) {
  const db = ctx.database!;

  const user = await db.queryOne<{ metadata: UserMetadata | null }>(
    'SELECT metadata FROM users WHERE id = $1',
    [userId],
  );

  if (!user) throw new ServerError('User not found');

  const currentMetadata: UserMetadata = user.metadata || {};
  const currentDashboard = (currentMetadata.dashboard as Record<string, DashboardPreference> | undefined) || {};
  const nextPreference: DashboardPreference = {
    ...preference,
    updated_at: new Date().toISOString(),
  };

  const nextMetadata = {
    ...currentMetadata,
    dashboard: {
      ...currentDashboard,
      [page]: nextPreference,
    },
  };

  const updated = await db.queryOne<{ metadata: UserMetadata }>(
    `
      UPDATE users
      SET metadata = $2::jsonb, updated_at = now()
      WHERE id = $1
      RETURNING metadata
    `,
    [userId, JSON.stringify(nextMetadata)],
  );

  if (!updated) throw new ServerError('User not found');

  const updatedDashboard = updated.metadata.dashboard as Record<string, DashboardPreference> | undefined;
  return updatedDashboard?.[page] || nextPreference;
}

export const getDashboardPreferences = RegisterService(getDashboardPreferencesService);
export const updateDashboardPreferences = RegisterService(updateDashboardPreferencesService);
