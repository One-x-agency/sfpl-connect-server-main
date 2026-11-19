import { fileURLToPath } from 'url';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import Database from '@/service/database/index.js';
import Logger from '@/service/logger/index.js';
import RedisClient from '@/service/redis/index.js';
import { s3 } from '@/service/aws/index.js';
import { withCronTask } from '@/core/cron/withCronTask.js';

/**
 * Purge soft-deleted customers (role=customer, is_deleted, deleted_at >= 20 days).
 *
 * REMOVED
 * - device_input_fields (pins) + custom_notification_schemas / diagram_pins on those pins
 * - device_logs + device_log_archives (+ S3 zip objects)
 * - support_tickets (remarks/attachments cascade)
 * - user_sessions
 * - notification_logs / notification_tokens / notifications (generated alerts)
 * - Redis cache keys `device:imei:*` for affected devices (refresh only)
 *
 * KEPT
 * - users row (soft-deleted customer account)
 * - devices (still assigned: user_id + project_id unchanged)
 * - projects
 * - sim_cards link on devices
 * - connect_store_* (orders, invoices, carts, addresses)
 * - customer_addresses / activity_logs / staff_activity_logs
 * - other device fields (imei, name, firmware, meta_data, location, etc.)
 */
export const task = withCronTask('purge-deleted-customers', async () => {
  const db = await Database.getConnection();

  try {
    await db.begin();

    await db.query(
      `
        CREATE TEMP TABLE target_deleted_customers ON COMMIT DROP AS
        SELECT id
        FROM users
        WHERE role = 'customer'
          AND is_deleted = true
          AND deleted_at <= NOW() - INTERVAL '20 days'
      `,
    );

    const targetCustomers = await db.queryOne<{ count: number }>(
      `
        SELECT COUNT(*)::int AS count
        FROM target_deleted_customers
      `,
    );

    if (!targetCustomers?.count) {
      await db.commit();
      Logger.info('Customer purge cron completed. No customers to purge.');
      return;
    }

    const affectedDevicesResult = await db.query(
      `
        SELECT id, imei
        FROM devices
        WHERE user_id IN (SELECT id FROM target_deleted_customers)
      `,
    );
    const affectedDevices = affectedDevicesResult.rows as { id: string; imei: string }[];

    const archivesResult = await db.query(
      `
        SELECT s3_bucket, s3_key
        FROM device_log_archives
        WHERE device_id IN (
          SELECT id FROM devices
          WHERE user_id IN (SELECT id FROM target_deleted_customers)
        )
      `,
    );
    const archives = archivesResult.rows as { s3_bucket: string; s3_key: string }[];

    // Pin dependents must go before pins (no ON DELETE CASCADE on these FKs).
    await db.query(
      `
        DELETE FROM custom_notification_schemas cns
        USING device_input_fields dif
        WHERE cns.input_field_id = dif.id
          AND dif.device_id IN (
            SELECT id
            FROM devices
            WHERE user_id IN (SELECT id FROM target_deleted_customers)
          )
      `,
    );

    await db.query(
      `
        DELETE FROM diagram_pins dp
        USING device_input_fields dif
        WHERE dp.input_field_id = dif.id
          AND dif.device_id IN (
            SELECT id
            FROM devices
            WHERE user_id IN (SELECT id FROM target_deleted_customers)
          )
      `,
    );

    await db.query(
      `
        DELETE FROM device_input_fields
        WHERE device_id IN (
          SELECT id
          FROM devices
          WHERE user_id IN (SELECT id FROM target_deleted_customers)
        )
      `,
    );

    await db.query(
      `
        DELETE FROM device_logs
        WHERE device_id IN (
          SELECT id
          FROM devices
          WHERE user_id IN (SELECT id FROM target_deleted_customers)
        )
      `,
    );

    await db.query(
      `
        DELETE FROM device_log_archives
        WHERE device_id IN (
          SELECT id
          FROM devices
          WHERE user_id IN (SELECT id FROM target_deleted_customers)
        )
      `,
    );

    // Devices stay assigned to the soft-deleted customer (user_id / project_id kept).

    await db.query(
      `
        DELETE FROM support_tickets
        WHERE customer_id IN (SELECT id FROM target_deleted_customers)
      `,
    );

    await db.query(
      `
        DELETE FROM user_sessions
        WHERE user_id IN (SELECT id FROM target_deleted_customers)
      `,
    );

    await db.query(
      `
        DELETE FROM notification_logs
        WHERE user_id IN (SELECT id FROM target_deleted_customers)
      `,
    );

    await db.query(
      `
        DELETE FROM notification_tokens
        WHERE user_id IN (SELECT id FROM target_deleted_customers)
      `,
    );

    await db.query(
      `
        DELETE FROM notifications
        WHERE user_id IN (SELECT id FROM target_deleted_customers)
      `,
    );

    await db.commit();

    for (const archive of archives) {
      try {
        await s3.send(new DeleteObjectCommand({
          Bucket: archive.s3_bucket,
          Key: archive.s3_key,
        }));
      } catch (error) {
        Logger.error(
          `Customer purge: failed to delete S3 archive s3://${archive.s3_bucket}/${archive.s3_key}`,
          error,
        );
      }
    }

    for (const device of affectedDevices) {
      try {
        if (!RedisClient.isOpen) await RedisClient.connect();
        await RedisClient.del(`device:imei:${device.imei}`);
      } catch (error) {
        Logger.error(
          `Customer purge: failed to clear Redis cache for imei=${device.imei}`,
          error,
        );
      }
    }

    Logger.info(
      `Customer purge cron completed. customers=${targetCustomers.count}, devices=${affectedDevices.length}, archives_deleted=${archives.length}`,
    );
  } catch (error) {
    await db.rollback();
    Logger.error('Customer purge cron failed', error);
    throw error;
  } finally {
    db.release();
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  task().catch((error) => {
    Logger.error('Customer purge cron failed', error);
    process.exit(1);
  });
}
