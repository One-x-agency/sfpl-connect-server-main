import type { Request, Response } from 'express';
import ServerEvents from '@/service/event/index.js';

export default async function Controller(req: Request, res: Response) {

  console.log('new hardware record :', req.body);
  const {
    imei, timestamp, signal_strength, adc_channels
  } = req.body;

  const [datePart, timePart] = timestamp.split('+')[0].split(',');
  const [yy, mm, dd] = datePart.split('/').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);

  const year = 2000 + yy;
  const month = mm - 1;
  const day = dd;

  // Convert IST (UTC+05:30) components to a UTC Date
  const istOffsetMinutes = (5 * 60) + 30;
  const utcMs = Date.UTC(year, month, day, hour, minute, second) - (istOffsetMinutes * 60 * 1000);
  const date = new Date(utcMs);

  console.log('new hardware imei :', imei);

  const newRecord = {
    imei,
    timestamp: date,
    priority: 0,
    event_trigger_id: 0,
    gps: {
      latitude: 0,
      longitude: 0,
      altitude: 0,
      angle: 0,
      satellites: 0,
      speed: 0,
    },
    data: { ...adc_channels, 21: signal_strength },
  };

  ServerEvents.emit('receiver:record:received', newRecord);

  res.status(204).end();
}
