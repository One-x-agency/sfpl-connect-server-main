import type { Context } from '@/core/registerService.js';
import RegisterService from '@/core/registerService.js';
import { Publisher } from '@/service/redis/index.js';

async function createCustomNotificationService(
  ctx: Context,
  input: {
    name: string;
    description?: string | null;
    input_field_id: string;
    operator: string;
    value: number;
    send_to_email: boolean;
    send_to_sms: boolean;
  },
) {
  const db = ctx.database!;

  const customNotification = await db.namedQueryOne(
    `
      INSERT INTO custom_notification_schemas (
        name,
        description,
        input_field_id,
        operator,
        value,
        send_to_email,
        send_to_sms
      )
      VALUES (
        $name,
        $description,
        $input_field_id,
        $operator,
        $value,
        $send_to_email,
        $send_to_sms
      )
      RETURNING
        id,
        name,
        description,
        input_field_id,
        operator,
        value,
        send_to_email,
        send_to_sms,
        created_at,
        updated_at
    `,
    {
      name: input.name,
      description: input.description,
      input_field_id: input.input_field_id,
      operator: input.operator,
      value: input.value,
      send_to_email: input.send_to_email,
      send_to_sms: input.send_to_sms,
    },
  );

  Publisher.publish('custom_notification_schema:created', JSON.stringify({
    id: customNotification.id,
    input_field_id: customNotification.input_field_id,
  }));

  return customNotification;
}

async function updateCustomNotificationService(
  ctx: Context,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    input_field_id?: string;
    operator?: string;
    value?: number;
    send_to_email?: boolean;
    send_to_sms?: boolean;
  },
) {
  const db = ctx.database!;
  const updateArray: string[] = [];

  if (input.name !== undefined) updateArray.push('name = $name');

  if (input.description !== undefined) updateArray.push('description = $description');

  if (input.input_field_id !== undefined) updateArray.push('input_field_id = $input_field_id');

  if (input.operator !== undefined) updateArray.push('operator = $operator');

  if (input.value !== undefined) updateArray.push('value = $value');

  if (input.send_to_email !== undefined) updateArray.push('send_to_email = $send_to_email');

  if (input.send_to_sms !== undefined) updateArray.push('send_to_sms = $send_to_sms');

  if (!updateArray.length) {
    throw new Error('No updatable fields provided');
  }

  updateArray.push('updated_at = now()');

  const updatedCustomNotification = await db.namedQueryOne(
    `
      UPDATE custom_notification_schemas
      SET ${updateArray.join(', ')}
      WHERE id = $id
      RETURNING
        id,
        name,
        description,
        input_field_id,
        operator,
        value,
        send_to_email,
        send_to_sms,
        created_at,
        updated_at
    `,
    {
      id,
      name: input.name,
      description: input.description ?? null,
      input_field_id: input.input_field_id,
      operator: input.operator,
      value: input.value,
      send_to_email: input.send_to_email,
      send_to_sms: input.send_to_sms,
    },
  );

  if (updatedCustomNotification) {
    Publisher.publish('custom_notification_schema:updated', JSON.stringify({
      id: updatedCustomNotification.id,
      input_field_id: updatedCustomNotification.input_field_id,
    }));
  }

  return updatedCustomNotification;
}

async function deleteCustomNotificationService(
  ctx: Context,
  id: string,
) {
  const db = ctx.database!;

  const deleted = await db.queryOne(
    `
      DELETE FROM custom_notification_schemas
      WHERE id = $1
      RETURNING id, input_field_id
    `,
    [id],
  );

  if (deleted) {
    Publisher.publish('custom_notification_schema:deleted', JSON.stringify({
      id: deleted.id,
      input_field_id: deleted.input_field_id,
    }));
  }

  return deleted;
}

export const createCustomNotification = RegisterService(createCustomNotificationService);
export const updateCustomNotification = RegisterService(updateCustomNotificationService);
export const deleteCustomNotification = RegisterService(deleteCustomNotificationService);
