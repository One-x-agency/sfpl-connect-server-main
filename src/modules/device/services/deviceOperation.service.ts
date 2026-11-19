import type { Context as ServiceContext } from '@/core/registerService.js';
import ServerError from '@/core/serverError.class.js';

import RegisterService from '@/core/registerService.js';

async function getDeviceByImeiService(
  ctx: ServiceContext,
  imei: string,
) {
  const db = ctx.database!;
  return db.queryOne(
    `
      SELECT
        id,
        imei,
        project_id,
        name,
        description,
        sim_card_id,
        latitude,
        longitude,
        user_id,
        created_at
      FROM devices
      WHERE imei = $1
    `,
    [imei],
  );
}



async function createDeviceService(
  ctx : ServiceContext,
  input: {
    imei: string;
    name: string | null;
    description: string | null;
    latitude: number | null;
    longitude: number | null;
    user_id: string | null;
    firmware_version?: string | null;
    batch_number?: string | null;
  },
){
  const existing = await getDeviceByImeiService({ database: ctx.database }, input.imei);

  if (existing) throw new ServerError('Device with this IMEI already exists');

  const db = ctx.database!;
  const created = await db.queryOne(
    `
      INSERT INTO devices (
        imei,
        project_id,
        name,
        description,
        latitude,
        longitude,
        user_id,
        firmware_version,
        batch_number
      )
      VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, imei, project_id, name, description, sim_card_id, latitude, longitude, user_id,
        firmware_version, meta_data, order_id, serial_number, serial, batch_number,
        created_at, updated_at
    `,
    [
      input.imei,
      input.name ?? null,
      input.description ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.user_id ?? null,
      input.firmware_version ?? '1.0.0',
      input.batch_number ?? null,
    ],
  );

  return created;
}


async function findDeviceByIdService(
  ctx: ServiceContext,
  id: string,
) {
  const db = ctx.database!;
  return db.queryOne(
    `
      SELECT
        id,
        imei,
        project_id,
        name,
        description,
        sim_card_id,
        latitude,
        longitude,
        user_id,
        firmware_version,
        meta_data,
        order_id,
        serial_number,
        serial,
        batch_number,
        created_at,
        updated_at
      FROM devices
      WHERE id = $1
    `,
    [id],
  );
}


async function updateDeviceService(
  ctx: ServiceContext,
  id: string,
  input: {
    name?: string | null;
    description?: string | null;
    project_id?: string | null;
    sim_card_id?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    user_id?: string | null;
    firmware_version?: string | null;
    batch_number?: string | null;
  },
) {
  const db = ctx.database!;
  const existingDevice = await findDeviceByIdService({ database: db }, id);
  if (!existingDevice) {
    throw new ServerError('Device not found');
  }

  const isUserChanged = input.user_id !== undefined && input.user_id !== existingDevice.user_id;

  const fields: string[] = [];

  if (input.name !== undefined) {
    fields.push('name = $name');
  }

  if (input.description !== undefined) {
    fields.push('description = $description');
  }

  const projectId = isUserChanged ? null : input.project_id;
  if (isUserChanged) {
    fields.push('project_id = $project_id');
  } else if (input.project_id !== undefined) {
    fields.push('project_id = $project_id');
  }

  if (input.sim_card_id !== undefined) {
    fields.push('sim_card_id = $sim_card_id');
  }

  if (input.latitude !== undefined) {
    fields.push('latitude = $latitude');
  }

  if (input.longitude !== undefined) {
    fields.push('longitude = $longitude');
  }

  if (input.user_id !== undefined) {
    fields.push('user_id = $user_id');
  }

  if (input.firmware_version !== undefined) {
    fields.push('firmware_version = $firmware_version');
  }

  if (input.batch_number !== undefined) {
    fields.push('batch_number = $batch_number');
  }

  if (!fields.length) {
    throw new ServerError('No updatable fields provided');
  }

  fields.push('updated_at = now()');

  const updated = await db.namedQueryOne(
    `
      UPDATE devices
      SET ${fields.join(', ')}
      WHERE id = $id
      RETURNING id, imei, project_id, name, description, sim_card_id, latitude, longitude, user_id,
        firmware_version, meta_data, order_id, serial_number, serial, batch_number,
        created_at, updated_at
    `,
    {
      id,
      name: input.name,
      description: input.description,
      project_id: projectId,
      sim_card_id: input.sim_card_id,
      latitude: input.latitude,
      longitude: input.longitude,
      user_id: input.user_id,
      firmware_version: input.firmware_version,
      batch_number: input.batch_number,
    },
  );

  if (!updated) {
    throw new ServerError('Device not found');
  }

  return updated;
}



async function deleteDeviceService(ctx: ServiceContext, id: string){
  const db = ctx.database!;

  try{
    await db.begin();

    await db.query(
      `
        DELETE FROM custom_notification_schemas cns
        USING device_input_fields dif
        WHERE cns.input_field_id = dif.id
          AND dif.device_id = $1
      `,
      [id],
    );

    await db.query('DELETE FROM device_input_fields WHERE device_id = $1', [id]);
    await db.query('DELETE FROM device_logs WHERE device_id = $1', [id]);

    const deleted = await db.queryOne(
      `
        DELETE FROM devices
        WHERE id = $1
        RETURNING id, imei
      `,
      [id],
    );
    await db.commit();
    return deleted;

  } catch(error) {
    await db.rollback();
    throw error;
  }

}



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

  await db.query(
    `
      DELETE FROM custom_notification_schemas
      WHERE input_field_id = $1
    `,
    [inputFieldId],
  );

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

async function createDeviceLogService(
  ctx: ServiceContext,
  input: {
    device_id: string;
    imei: string;
    timestamp: Date;
    status: 'inactive' | 'healthy' | 'warning' | 'critical';
    data: Record<string, any>;
  },
) {

  await ctx.database.query(
    `
      INSERT INTO device_logs (
        device_id,
        imei,
        "timestamp",
        data,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      input.device_id,
      input.imei,
      input.timestamp.toISOString(),
      input.data,
      input.status,
    ],
  );

}


export const getDeviceByImei = RegisterService(getDeviceByImeiService);
export const createDevice = RegisterService(createDeviceService);
export const findDeviceById = RegisterService(findDeviceByIdService);

export const updateDevice = RegisterService(updateDeviceService);
export const deleteDevice = RegisterService(deleteDeviceService);

export const createDeviceInputField = RegisterService(createDeviceInputFieldService);
export const updateDeviceInputField = RegisterService(updateDeviceInputFieldService);
export const deleteDeviceInputField = RegisterService(deleteDeviceInputFieldService);
export const createDeviceLog = RegisterService(createDeviceLogService);

