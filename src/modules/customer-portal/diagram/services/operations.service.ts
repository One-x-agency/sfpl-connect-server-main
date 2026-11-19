import type { Context } from '@/core/registerService.js';
import RegisterService from '@/core/registerService.js';
import ServerError from '@/core/serverError.class.js';
import { v7 as uuidv7 } from 'uuid';

async function createDiagramService(
  ctx: Context,
  input: {
    name: string;
    config: Record<string, unknown>;
    created_by: string;
  },
) {
  const db = ctx.database!;

  return db.namedQueryOne(
    `
      INSERT INTO diagrams (name, config, created_by)
      VALUES ($name, $config::jsonb, $created_by)
      RETURNING
        id,
        name,
        config,
        created_by,
        created_at,
        updated_at
    `,
    {
      name: input.name,
      config: JSON.stringify(input.config),
      created_by: input.created_by,
    },
  );
}

async function updateDiagramService(
  ctx: Context,
  id: string,
  created_by: string,
  input: {
    name?: string;
    config?: Record<string, unknown>;
  },
) {
  const db = ctx.database!;
  const parts: string[] = [];

  if (input.name !== undefined) parts.push('name = $name');
  if (input.config !== undefined) parts.push('config = $config::jsonb');

  if (!parts.length) throw new ServerError('No updatable fields provided');

  parts.push('updated_at = now()');

  return db.namedQueryOne(
    `
      UPDATE diagrams
      SET ${parts.join(', ')}
      WHERE id = $id AND created_by = $created_by
      RETURNING
        id,
        name,
        config,
        created_by,
        created_at,
        updated_at
    `,
    {
      id,
      created_by,
      name: input.name,
      config: input.config !== undefined ? JSON.stringify(input.config) : undefined,
    },
  );
}

async function deleteDiagramService(
  ctx: Context,
  id: string,
  created_by: string,
) {
  const db = ctx.database!;

  await db.begin();
  try {
    await db.query('DELETE FROM diagram_pins WHERE diagram_id = $1', [id]);
    await db.query('DELETE FROM diagram_images WHERE diagram_id = $1', [id]);
    const row = await db.queryOne<{ id: string }>(
      'DELETE FROM diagrams WHERE id = $1 AND created_by = $2 RETURNING id',
      [id, created_by],
    );
    await db.commit();
    return row;
  } catch (err) {
    await db.rollback();
    throw err;
  }
}

async function createDiagramImageService(
  ctx: Context,
  input: {
    diagram_id: string;
    file_id: string;
    config: Record<string, unknown>;
    created_by: string;
    /** Same as new row id for fresh uploads; source row’s group id when reusing from recent. */
    original_image_id?: string;
  },
) {
  const db = ctx.database!;
  const imageId = uuidv7();
  const originalImageId = input.original_image_id ?? imageId;

  return db.namedQueryOne(
    `
      INSERT INTO diagram_images (id, diagram_id, file_id, config, created_by, original_image_id)
      VALUES ($id, $diagram_id, $file_id, $config::jsonb, $created_by, $original_image_id)
      RETURNING
        id,
        diagram_id,
        file_id,
        original_image_id,
        config,
        created_by,
        created_at
    `,
    {
      id: imageId,
      diagram_id: input.diagram_id,
      file_id: input.file_id,
      config: JSON.stringify(input.config),
      created_by: input.created_by,
      original_image_id: originalImageId,
    },
  );
}

async function deleteDiagramImageService(
  ctx: Context,
  image_id: string,
  diagram_id: string,
  created_by: string,
) {
  const db = ctx.database!;

  return db.queryOne<{ id: string }>(
    `
      DELETE FROM diagram_images di
      USING diagrams dg
      WHERE di.id = $1
        AND di.diagram_id = $2
        AND dg.id = di.diagram_id
        AND dg.created_by = $3
      RETURNING di.id
    `,
    [image_id, diagram_id, created_by],
  );
}

async function createDiagramPinService(
  ctx: Context,
  input: {
    diagram_id: string;
    input_field_id: string;
    config: Record<string, unknown>;
  },
) {
  const db = ctx.database!;

  return db.namedQueryOne(
    `
      INSERT INTO diagram_pins (diagram_id, input_field_id, config)
      VALUES ($diagram_id, $input_field_id, $config::jsonb)
      RETURNING
        id,
        diagram_id,
        input_field_id,
        config
    `,
    {
      diagram_id: input.diagram_id,
      input_field_id: input.input_field_id,
      config: JSON.stringify(input.config),
    },
  );
}

async function updateDiagramPinService(
  ctx: Context,
  pin_id: string,
  diagram_id: string,
  created_by: string,
  input: {
    input_field_id?: string;
    config?: Record<string, unknown>;
  },
) {
  const db = ctx.database!;
  const parts: string[] = [];

  if (input.input_field_id !== undefined) parts.push('input_field_id = $input_field_id');
  if (input.config !== undefined) parts.push('config = $config::jsonb');

  if (!parts.length) throw new ServerError('No updatable fields provided');

  return db.namedQueryOne(
    `
      UPDATE diagram_pins dp
      SET ${parts.join(', ')}
      FROM diagrams dg
      WHERE dp.id = $pin_id
        AND dp.diagram_id = $diagram_id
        AND dg.id = dp.diagram_id
        AND dg.created_by = $created_by
      RETURNING
        dp.id,
        dp.diagram_id,
        dp.input_field_id,
        dp.config
    `,
    {
      pin_id,
      diagram_id,
      created_by,
      input_field_id: input.input_field_id,
      config: input.config !== undefined ? JSON.stringify(input.config) : undefined,
    },
  );
}

async function deleteDiagramPinService(
  ctx: Context,
  pin_id: string,
  diagram_id: string,
  created_by: string,
) {
  const db = ctx.database!;

  return db.queryOne<{ id: string }>(
    `
      DELETE FROM diagram_pins dp
      USING diagrams dg
      WHERE dp.id = $1
        AND dp.diagram_id = $2
        AND dg.id = dp.diagram_id
        AND dg.created_by = $3
      RETURNING dp.id
    `,
    [pin_id, diagram_id, created_by],
  );
}

export const createDiagram = RegisterService(createDiagramService);
export const updateDiagram = RegisterService(updateDiagramService);
export const deleteDiagram = RegisterService(deleteDiagramService);
export const createDiagramImage = RegisterService(createDiagramImageService);
export const deleteDiagramImage = RegisterService(deleteDiagramImageService);
export const createDiagramPin = RegisterService(createDiagramPinService);
export const updateDiagramPin = RegisterService(updateDiagramPinService);
export const deleteDiagramPin = RegisterService(deleteDiagramPinService);
