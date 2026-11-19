import  { Device as DeviceConstants } from '@/config/constant.js';
import RedisClient from '@/service/redis/index.js';
import { getDeviceFromDB } from './services/deviceClass.service.js';
import { createDeviceLog } from './device.service.js';


function mapCalibration(voltage: number, calibration: {voltage: number, value: number}[]): number {

  if (calibration.length < 2) throw new Error('Calibration must be an array with at least two points.');

  // If voltage is below the first calibration point → extrapolate down
  if (voltage <= calibration[0].voltage) {
    const p1 = calibration[0];
    const p2 = calibration[1];
    const slope = (p2.value - p1.value) / (p2.voltage - p1.voltage);
    return p1.value + (voltage - p1.voltage) * slope;
  }

  // If voltage is above the last calibration point → extrapolate up
  if (voltage >= calibration[calibration.length - 1].voltage) {
    const p1 = calibration[calibration.length - 2];
    const p2 = calibration[calibration.length - 1];
    const slope = (p2.value - p1.value) / (p2.voltage - p1.voltage);
    return p2.value + (voltage - p2.voltage) * slope;
  }

  // Otherwise, interpolate between the two surrounding points
  for (let i = 0; i < calibration.length - 1; i += 1) {
    const p1 = calibration[i];
    const p2 = calibration[i + 1];

    if (voltage >= p1.voltage && voltage <= p2.voltage) {
      const slope = (p2.value - p1.value) / (p2.voltage - p1.voltage);
      return p1.value + (voltage - p1.voltage) * slope;
    }
  }

  // Should never reach here
  throw new Error('Unable to calculate fuel level.');
}


function isConditionTrue(value: number, operator: Validation['operator'], valueToCompare: number): boolean {

  switch (operator) {
    case '>':
      return value > valueToCompare;
    case '<':
      return value < valueToCompare;
    case '=':
      return value === valueToCompare;
    case '>=':
      return value >= valueToCompare;
    case '<=':
      return value <= valueToCompare;
    case '!=':
      return value !== valueToCompare;
    default:
      return false;
  }
}

type CustomNotificationSchema = {
  id: string;
  name: string;
  description: string | null;
  input_field_id: string;
  operator: Validation['operator'];
  value: number;
  send_to_email: boolean;
  send_to_sms: boolean;
};

type DeviceInputField = {
  id: string;
  io_pin: string;
  name: string;
  conversation_factor: number;
  calibration: CalibrationPoint[];
  validation: Validation | null;
  unit: string | null;
  priority: number;
  custom_notification_schemas: CustomNotificationSchema[];
};

type RawData = Record<string, number>;


type ProcessedData = Record<string, {
  is_safe : boolean;
  value : number;
  unit : string | null;
  name : string;
  priority: number;
}>;

type RawRecord = {
  imei: string;
  timestamp: Date;
  gps?: {
    latitude: number;
    longitude: number;
    altitude: number;
    angle: number;
    satellites: number;
    speed: number;
  };
  data: RawData;
};

type ProcessedRecord = {
  imei: string;
  timestamp: Date;
  status: 'inactive' | 'healthy' | 'warning' | 'critical';
  gps?: {
    latitude: number;
    longitude: number;
    altitude: number;
    angle: number;
    satellites: number;
    speed: number;
  };
  data: ProcessedData;
};

type CalibrationPoint = {
  voltage: number;
  value: number;
};

type Validation = {
  operator: (typeof DeviceConstants.inputField.validation.operators)[number];
  value: number;
};


export type DeviceInput = {
  id: string;
  user_id: string;
  imei: string;
  input_fields: DeviceInputField[];
  last_record?: ProcessedRecord | null;
};

export default class Device {
  id: string;

  user_id: string;

  imei: string;

  last_record : ProcessedRecord | null;

  input_fields: DeviceInputField[];

  constructor(device:DeviceInput) {
    this.id = device.id;
    this.user_id = device.user_id;
    this.imei = device.imei;
    this.input_fields = device.input_fields;
    this.last_record = device.last_record ?? null;
  }


  async registerRecord(record: ProcessedRecord) {
    await createDeviceLog({ withDatabase: true }, {
      device_id: this.id,
      imei: record.imei,
      status: record.status,
      timestamp: record.timestamp,
      data: record.data,
    });

    this.last_record = record;
    await this.saveToCache();
  }

  processRawData(record: RawData){
    const processedData = Object.keys(record).reduce((acc, key) => {

      const inputField = this.input_fields.find(field => field.io_pin === key);
      if (!inputField) return acc;

      let processedValue = record[key] * inputField.conversation_factor;
      if (inputField.calibration.length > 1) processedValue = mapCalibration(processedValue, inputField.calibration);

      const isSafe = inputField.validation ? isConditionTrue(processedValue, inputField.validation.operator, inputField.validation.value) : true;

      return {
        ...acc,
        [inputField.id] : {
          name: inputField.name,
          unit: inputField.unit,
          value: processedValue,
          is_safe: isSafe,
          priority: inputField.priority,
        }
      };

    }, {});
    return processedData;
  }

  async saveToCache({ ttl }: {ttl?: number} = {}) {
    await RedisClient.json.set(`device:imei:${this.imei}`, '$', {
      id: this.id,
      imei: this.imei,
      user_id: this.user_id,
      input_fields: this.input_fields,
      last_record: this.last_record,
    });

    if (ttl) {
      await RedisClient.expire(`device:imei:${this.imei}`, ttl);
    }
  }

  async refreshCache() {
    const device = await getDeviceFromDB({ withDatabase: true }, this.imei);
    if (!device) return;
    this.id = device.id;
    this.imei = device.imei;
    this.input_fields = device.input_fields;
    await this.saveToCache();
  }


  generateNotifications(data: ProcessedData): {
    notification: {
      type: 'custom_notification';
      title: string;
      body: string;
      device_id: string;
      input_field_id: string;
      schema_id: string;
      value: string;
    };
    transports: {
      email: boolean;
      sms: boolean;
    };
  }[] {

    const notifications = [];
    Object.keys(data).forEach(key => {

      const customNotificationSchemas = this.input_fields.find(field => field.id === key)?.custom_notification_schemas;
      if (!customNotificationSchemas || customNotificationSchemas.length === 0) return;

      const currentValue = data[key].value;
      const lastValue = this.last_record?.data?.[key]?.value;

      customNotificationSchemas.forEach(schema => {
        const isCurrentValueUnSafe = isConditionTrue(currentValue, schema.operator, schema.value);
        const isLastValueUnSafe = lastValue ? isConditionTrue(lastValue, schema.operator, schema.value) : false;

        if (isCurrentValueUnSafe && !isLastValueUnSafe) {
          notifications.push({
            notification: {
              type: 'custom_notification',
              title: schema.name,
              body: schema.description,
              device_id: this.id,
              input_field_id: key,
              custom_notification_schema_id: schema.id,
              value: currentValue.toString(),
              operator: schema.operator,
              value_to_compare: schema.value.toString(),
            },
            transports: {
              email: schema.send_to_email,
              sms: schema.send_to_sms,
            }
          });
        }

      });
    });
    return notifications;
  }

  generateStatus(data : ProcessedData | null){
    let priority = 0;

    if (!data) return 'inactive';

    Object.values(data).forEach(field => {
      if (!field.is_safe && field.priority > priority) {
        priority = field.priority;
      }
    });

    switch (priority) {
      case 0:
        return 'healthy';
      case 1:
        return 'warning';
      case 2:
        return 'critical';
      default:
        return 'critical';
    }
  }

  async processRawRecord(record: RawRecord){
    const processedData = this.processRawData(record.data);
    const notifications = this.generateNotifications(processedData);

    const lastRecord = this.last_record;

    const status = this.generateStatus(processedData);

    await this.registerRecord({
      ...record,
      status,
      data: processedData,
    });

    return {
      notifications,
      record: this.last_record,
      lastRecord,
    };
  }


  get status(): 'inactive' | 'healthy' | 'warning' | 'critical' {
    return this.last_record?.status ?? 'inactive';
  }
}
