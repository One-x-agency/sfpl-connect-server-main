/**
 * File module server events. Merged into global ServerEvents (no import in central types).
 */
declare global {
  interface ServerEvents {
    'device:input_field:created': (payload : { id: string, device_id: string}) => void;
    'device:input_field:updated': (payload : { id: string, device_id: string}) => void;
    'device:input_field:deleted': (payload : { id: string, device_id: string}) => void;

  }
}

export {};
