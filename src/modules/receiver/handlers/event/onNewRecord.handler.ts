import type { Context } from '@/core/registerServerEventHandler.js';
import type { RawData } from '@/modules/receiver/types/serverEvents.js';
import { fetchDeviceByImei } from '@/modules/device/device.service.js';
import Logger from '@/service/logger/index.js';
import Socket from '@/socket.js';
import ServerEvents from '@/service/event/index.js';
import RegisterServerEventHandler from '@/core/registerServerEventHandler.js';
import { generateUserNotification } from '@/modules/notification/services/notificationOperation.service.js';



export async function Handler(ctx: Context, record: RawData) {

  const device = await fetchDeviceByImei(ctx, record.imei);
  if (!device) return Logger.error('Device not found with imei : ' + record.imei);
  await device.saveToCache({ ttl: 60 * 5 }); // for 5 minutes

  const { notifications, record: newRecord, lastRecord } = await device.processRawRecord(record);

  Socket.io.emit(
    `record:${device.imei}`,
    newRecord
  );

  if(lastRecord?.status !== newRecord?.status) {
    Socket.io.emit(
      'device:status',
      {
        id: device.id,
        imei: device.imei,
        status: newRecord?.status,
        timestamp: newRecord?.timestamp,
      }
    );
  }

  if (notifications.length > 0) {
    await Promise.all(
      notifications.map(async (notification) => {
        await generateUserNotification({ withDatabase:true }, [device.user_id], notification.notification, {
          database: true,
          email: notification.transports.email,
          sms: notification.transports.sms,
          push_notification: true
        });
      })
    );
  }

}


ServerEvents.on('receiver:record:received', RegisterServerEventHandler(Handler, { withDatabase: true }));
