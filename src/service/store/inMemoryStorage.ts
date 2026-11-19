import type Device from '@/modules/device/device.class.js';

export interface MemoryStorageShape {
  devices: Record<string, Device>;
}

const MemoryStorage: MemoryStorageShape = {
  devices: {},
};

export default MemoryStorage;

