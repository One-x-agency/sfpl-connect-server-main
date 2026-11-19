import type { Context as ServiceContext } from '@/core/registerService.js';
import ServerError from '@/core/serverError.class.js';
import RegisterService from '@/core/registerService.js';

async function createDeviceInputFieldService(
  ctx: ServiceContext,
  input: {
    device_id: string;
    io_pin: string;
    name: string;
    description: string | null;
    conversation_factor: number;
    calibration: any[];
    validation: any;
    unit: string | null;
    priority?: number;
  },
) {
  const db = ctx.database!;

  const created = await db.queryOne(
    `
      INSERT INTO device_input_fields (
        device_id,
        io_pin,
        name,
        description,
        conversation_factor,
        calibration,
        validation,
        unit,
        priority
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        (
          CASE WHEN $7::input_field_validation_operator IS NOT NULL AND $8::numeric(10,2) IS NOT NULL THEN
            ROW($7::input_field_validation_operator, $8::numeric(10,2))::input_field_validation
          ELSE NULL END
        ),
        $9,
        $10
      )
      RETURNING
        id,
        device_id,
        io_pin,
        name,
        description,
        conversation_factor,
        calibration,
        validation,
        unit,
        priority,
        created_at
    `,
    [
      input.device_id,
      input.io_pin,
      input.name,
      input.description ?? null,
      input.conversation_factor,
      input.calibration,
      input.validation?.operator ?? null,
      input.validation?.value ?? null,
      input.unit ?? null,
      input.priority ?? 0,
    ],
  );

  return created;
}

async function updateDeviceInputFieldService(
  ctx: ServiceContext,
  inputFieldId: string,
  input: {
    name?: string;
    description?: string | null;
    conversation_factor?: number;
    calibration?: any[];
    validation?: any;
    unit?: string | null;
    priority?: number;
  },
) {
  const db = ctx.database!;

  const updateArray = [];

  if (input.name !== undefined) updateArray.push('name = $name');

  if (input.description !== undefined) updateArray.push('description = $description');

  if (input.conversation_factor !== undefined) updateArray.push('conversation_factor = $conversation_factor');

  if (input.calibration !== undefined) updateArray.push('calibration = $calibration');

  if (input.validation !== undefined) updateArray.push('validation = (CASE WHEN $operator::input_field_validation_operator IS NOT NULL AND $value::numeric(10,2) IS NOT NULL THEN ROW($operator::input_field_validation_operator, $value::numeric(10,2))::input_field_validation ELSE NULL END)');

  if (input.unit !== undefined) updateArray.push('unit = $unit');

  if (input.priority !== undefined) updateArray.push('priority = $priority');

  if (!updateArray.length) {
    throw new ServerError('No updatable fields provided');
  }

  const updated = await db.namedQueryOne(
    `
      UPDATE device_input_fields
      SET ${updateArray.join(', ')}
      WHERE id = $inputFieldId
      RETURNING
        id,
        device_id,
        io_pin,
        name,
        description,
        conversation_factor,
        calibration,
        validation,
        unit,
        priority,
        created_at
    `,
    {
      inputFieldId,
      name: input.name,
      description: input.description,
      conversation_factor: input.conversation_factor,
      calibration: input.calibration,
      operator: input.validation?.operator ?? null,
      value: input.validation?.value ?? null,
      unit: input.unit,
      priority: input.priority,
    },
  );

  return updated;
}

async function deleteDeviceInputFieldService(
  ctx: ServiceContext,
  inputFieldId: string,
) {
  const db = ctx.database!;

  const deleted = await db.queryOne(
    `
      DELETE FROM device_input_fields
      WHERE id = $1
      RETURNING id, device_id
    `,
    [inputFieldId],
  );

  return deleted;
}

async function validateDeviceInputFieldService(
  ctx: ServiceContext,
  inputFieldId: string,
  customerId: string,
): Promise<void> {
  const db = ctx.database!;

  const exists = await db.queryOne(
    `
      SELECT 1
      FROM device_input_fields dif
      JOIN devices d ON d.id = dif.device_id
      WHERE dif.id = $1
        AND d.user_id = $2
    `,
    [inputFieldId, customerId],
  );

  if (!exists) {
    throw new ServerError('Device not found');
  }
}

async function copyDeviceConfigService(
  ctx: ServiceContext,
  input: {
    current_device_id: string;
    reference_device_id: string;
  },
) {
  const db = ctx.database!;

  if (input.current_device_id === input.reference_device_id) {
    throw new ServerError('Current device and reference device must be different');
  }

  await db.begin();

  try {
    const currentDevice = await db.queryOne(
      `
        SELECT id
        FROM devices
        WHERE id = $1
      `,
      [input.current_device_id],
    );

    if (!currentDevice) {
      throw new ServerError('Current device not found');
    }

    const referenceDevice = await db.queryOne(
      `
        SELECT id
        FROM devices
        WHERE id = $1
      `,
      [input.reference_device_id],
    );

    if (!referenceDevice) {
      throw new ServerError('Reference device not found');
    }

    const existingInputFieldsCountResult = await db.queryOne(
      `
        SELECT COUNT(*)::int AS count
        FROM device_input_fields
        WHERE device_id = $1
      `,
      [input.current_device_id],
    );

    if (existingInputFieldsCountResult && existingInputFieldsCountResult.count > 0) {
      throw new ServerError('Current device already has input fields configured');
    }

    const referenceInputFields = await db.queryAll(
      `
        SELECT
          id,
          io_pin,
          name,
          description,
          conversation_factor,
          calibration,
          (validation).operator AS validation_operator,
          (validation).value AS validation_value,
          unit,
          priority
        FROM device_input_fields
        WHERE device_id = $1
        ORDER BY priority ASC, created_at ASC
      `,
      [input.reference_device_id],
    );

    const inputFieldIdMap: Record<string, string> = {};

    for (const field of referenceInputFields) {
      const createdField = await db.queryOne(
        `
          INSERT INTO device_input_fields (
            device_id,
            io_pin,
            name,
            description,
            conversation_factor,
            calibration,
            validation,
            unit,
            priority
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            (
              CASE WHEN $7::input_field_validation_operator IS NOT NULL AND $8::numeric(10,2) IS NOT NULL THEN
                ROW($7::input_field_validation_operator, $8::numeric(10,2))::input_field_validation
              ELSE NULL END
            ),
            $9,
            $10
          )
          RETURNING
            id
        `,
        [
          input.current_device_id,
          field.io_pin,
          field.name,
          field.description ?? null,
          field.conversation_factor,
          field.calibration,
          field.validation_operator ?? null,
          field.validation_value ?? null,
          field.unit ?? null,
          field.priority ?? 0,
        ],
      );

      inputFieldIdMap[field.id] = createdField.id;
    }

    const referenceInputFieldIds = Object.keys(inputFieldIdMap);

    let copiedCustomNotificationsCount = 0;

    if (referenceInputFieldIds.length) {
      const referenceCustomNotifications = await db.namedQueryAll(
        `
          SELECT
            id,
            name,
            description,
            input_field_id,
            operator,
            value,
            send_to_email,
            send_to_sms
          FROM custom_notification_schemas
          WHERE input_field_id = ANY($input_field_ids)
        `,
        {
          input_field_ids: referenceInputFieldIds,
        },
      );

      for (const schema of referenceCustomNotifications) {
        const newInputFieldId = inputFieldIdMap[schema.input_field_id];
        if (!newInputFieldId) continue;

        await db.queryOne(
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
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7
            )
            RETURNING id
          `,
          [
            schema.name,
            schema.description ?? null,
            newInputFieldId,
            schema.operator,
            schema.value,
            schema.send_to_email,
            schema.send_to_sms,
          ],
        );

        copiedCustomNotificationsCount += 1;
      }
    }

    await db.commit();

    return {
      device_id: input.current_device_id,
      copied_input_fields: referenceInputFields.length,
      copied_custom_notifications: copiedCustomNotificationsCount,
    };
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

export const createDeviceInputField = RegisterService(createDeviceInputFieldService);
export const updateDeviceInputField = RegisterService(updateDeviceInputFieldService);
export const deleteDeviceInputField = RegisterService(deleteDeviceInputFieldService);
export const validateDeviceInputField = RegisterService(validateDeviceInputFieldService);
export const copyDeviceConfig = RegisterService(copyDeviceConfigService);

