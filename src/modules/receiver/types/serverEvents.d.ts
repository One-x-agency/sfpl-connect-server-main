import Constants from '@/config/constant.js';

export interface RawData {
  imei: string;
  timestamp: Date;
  priority: number;
  event_trigger_id: number;
  gps: {
    latitude: number;
    longitude: number;
    altitude: number;
    angle: number;
    satellites: number;
    speed: number;
  };
  data: {
    [key in (typeof Constants.deviceIoPins)] : number;
  };
}



declare global {
  interface ServerEvents {
    'receiver:record:received': (record: RawData) => void;
  }
}

export {};
