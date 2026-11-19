export interface RawDeviceLogRow {
  timestamp: Date | string;
  status: string;
  data: Record<string, { name?: string; value?: unknown }> | null;
  created_at: Date | string;
}

export type FlatDeviceLogRow = Record<string, string | number | boolean | Date | null>;

export function flattenDeviceLogRow(log: RawDeviceLogRow): FlatDeviceLogRow {
  const flat: FlatDeviceLogRow = {
    timestamp: log.timestamp,
    status: log.status,
    created_at: log.created_at,
  };

  if (log.data && typeof log.data === 'object') {
    Object.values(log.data).forEach((value) => {
      if (value && typeof value === 'object' && value.name != null) {
        const num = Number(value.value);
        flat[value.name] = Number.isFinite(num) ? num : (value.value as string | number | boolean | null);
      }
    });
  }

  return flat;
}
