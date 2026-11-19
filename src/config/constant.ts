import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import errorCodes from './errorCode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const temporaryFileStoragePath = path.join(__dirname, '../../tmp');

if (!fs.existsSync(temporaryFileStoragePath))
  fs.mkdirSync(temporaryFileStoragePath);


export enum HttpStatusCodes {
  OK = 200,
  SUCCESS = 204,
  BAD_REQUEST = 400,
  ALREADY_EXISTS = 409,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500
}

export enum TokenTypes {
  USER_ACCESS_TOKEN = 'user_access_token',
  CUSTOMER_ACCESS_TOKEN = 'customer_access_token',
  USER_REGISTRATION_TOKEN = 'user_registration_token',
  CUSTOMER_REGISTRATION_TOKEN = 'customer_registration_token',
  USER_PASSWORD_RESET_TOKEN = 'user_password_reset_token',
  CUSTOMER_PASSWORD_RESET_TOKEN = 'customer_password_reset_token',
  CUSTOMER_REFRESH_TOKEN = 'customer_refresh_token',
}

export const device_io_pin_options = [
  { value: '21', label: 'GSM Signal' },
  { value: 'A0', label: 'Analog pin 0' },
  { value: 'A1', label: 'Analog pin 1' },
  { value: 'A2', label: 'Analog pin 2' },
  { value: 'A3', label: 'Analog pin 3' },
  { value: 'A4', label: 'Analog pin 4' },
  { value: 'A5', label: 'Analog pin 5' },
  { value: 'A6', label: 'Analog pin 6' },
  { value: 'A7', label: 'Analog pin 7' },
  { value: 'A8', label: 'Analog pin 8' },
  { value: 'A9', label: 'Analog pin 9' },
  { value: 'VR', label: 'Voltage R' },
  { value: 'VY', label: 'Voltage Y' },
  { value: 'VB', label: 'Voltage B' },
  { value: 'IR', label: 'Ampere R' },
  { value: 'IY', label: 'Ampere Y' },
  { value: 'IB', label: 'Ampere B' },
] as const;

export const device_io_pins = device_io_pin_options.map((item) => item.value) as [
  (typeof device_io_pin_options)[number]['value'],
  ...(typeof device_io_pin_options)[number]['value'][],
];


export const Device = {
  inputField : {
    validation : {
      operators : ['<', '>', '<=', '>=', '=', '!='] as const,
    }
  }
};

export { errorCodes as ErrorCodes };


export default {
  temporaryFileStoragePath,

  deviceIoPins: device_io_pins,
  deviceIoPinOptions: device_io_pin_options,

  user: {
    token: {
      expiryInSeconds: 86400,
    },
  },
};

