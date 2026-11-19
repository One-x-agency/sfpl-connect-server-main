import ServerEvents from '@/service/event/index.js';

export default async function Handler(rowRecord: any) {

  const {
    imei, timestamp, adc_channels, signal_strength
  } = rowRecord;

  const [datePart, timePart] = timestamp.split(' ');
  const [yyyy, mm, dd] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);

  const year =  yyyy;
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

}
