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
  title: string;
  visible: boolean;
  props: Record<string, unknown>;
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

export function createOverviewDashboardPreference(): DashboardPreference {
  return {
    version: 1,
    widgets: [
      {
        id: 'environment-stats',
        type: 'environment-stats',
        props: {},
        title: 'Environment stats',
        visible: true,
      },
      {
        id: 'device-locations-map',
        type: 'device-locations-map',
        props: {},
        title: 'Device locations',
        visible: true,
      },
      {
        id: 'pin-history',
        type: 'pin-history',
        props: {},
        title: 'Pin history',
        visible: true,
      },
      {
        id: 'device-status-pie',
        type: 'device-status-pie',
        props: {},
        title: 'Device status',
        visible: true,
      },
      {
        id: 'status-heatmap',
        type: 'status-heatmap',
        props: {},
        title: 'Status heatmap',
        visible: true,
      },
      {
        id: 'project-device-pie',
        type: 'project-device-pie',
        props: {},
        title: 'Devices by project',
        visible: true,
      },
      {
        id: 'unread-alerts-list',
        type: 'unread-alerts-list',
        props: {},
        title: 'Unread alerts',
        visible: true,
      },
    ],
    layouts: {
      lg: [
        {
          h: 10,
          i: 'environment-stats',
          w: 2,
          x: 0,
          y: 0,
          minH: 4,
          minW: 2,
        },
        {
          h: 10,
          i: 'device-locations-map',
          w: 3,
          x: 2,
          y: 0,
          minH: 8,
          minW: 3,
        },
        {
          h: 10,
          i: 'pin-history',
          w: 9,
          x: 3,
          y: 10,
          minH: 8,
          minW: 4,
        },
        {
          h: 4,
          i: 'status-heatmap',
          w: 12,
          x: 0,
          y: 24,
          minH: 5,
          minW: 6,
        },
        {
          h: 8,
          i: 'device-status-pie',
          w: 3,
          x: 5,
          y: 0,
          minH: 10,
          minW: 3,
        },
        {
          h: 8,
          i: 'project-device-pie',
          w: 3,
          x: 0,
          y: 10,
          minH: 10,
          minW: 3,
        },
        {
          h: 10,
          i: 'unread-alerts-list',
          w: 4,
          x: 10,
          y: 0,
          minH: 8,
          minW: 3,
        },
      ],
      md: [
        {
          h: 4,
          i: 'environment-stats',
          w: 2,
          x: 0,
          y: 0,
          minH: 4,
          minW: 2,
        },
        {
          h: 10,
          i: 'device-locations-map',
          w: 5,
          x: 5,
          y: 0,
          minH: 8,
          minW: 3,
        },
        {
          h: 14,
          i: 'pin-history',
          w: 7,
          x: 0,
          y: 10,
          minH: 12,
          minW: 4,
        },
        {
          h: 8,
          i: 'status-heatmap',
          w: 10,
          x: 0,
          y: 24,
          minH: 6,
          minW: 5,
        },
        {
          h: 8,
          i: 'device-status-pie',
          w: 3,
          x: 7,
          y: 10,
          minH: 10,
          minW: 3,
        },
        {
          h: 8,
          i: 'project-device-pie',
          w: 3,
          x: 0,
          y: 32,
          minH: 10,
          minW: 3,
        },
        {
          h: 10,
          i: 'unread-alerts-list',
          w: 10,
          x: 0,
          y: 40,
          minH: 8,
          minW: 3,
        },
      ],
      sm: [
        {
          h: 4,
          i: 'environment-stats',
          w: 1,
          x: 0,
          y: 0,
          minH: 4,
          minW: 1,
        },
        {
          h: 10,
          i: 'device-locations-map',
          w: 1,
          x: 0,
          y: 10,
          minH: 8,
          minW: 1,
        },
        {
          h: 14,
          i: 'pin-history',
          w: 1,
          x: 0,
          y: 20,
          minH: 12,
          minW: 1,
        },
        {
          h: 8,
          i: 'status-heatmap',
          w: 1,
          x: 0,
          y: 46,
          minH: 6,
          minW: 1,
        },
        {
          h: 8,
          i: 'device-status-pie',
          w: 1,
          x: 0,
          y: 34,
          minH: 10,
          minW: 1,
        },
        {
          h: 8,
          i: 'project-device-pie',
          w: 1,
          x: 0,
          y: 54,
          minH: 10,
          minW: 1,
        },
        {
          h: 10,
          i: 'unread-alerts-list',
          w: 1,
          x: 0,
          y: 62,
          minH: 8,
          minW: 1,
        },
      ],
    },
    updated_at: new Date().toISOString(),
  };
}

export function createDefaultDashboardMetadata() {
  return {
    dashboard: {
      overview: createOverviewDashboardPreference(),
    },
  };
}

