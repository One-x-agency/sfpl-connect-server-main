import type { Context } from '@/core/registerService.js';
import ServerError from '@/core/serverError.class.js';
import RegisterService from '@/core/registerService.js';

async function createProjectService(
  ctx: Context,
  input: {
    user_id: string;
    name: string;
    description: string;
    address: string;
    latitude: number;
    longitude: number;
  },
) {
  const db = ctx.database!;
  const project = await db.queryOne(
    `
      INSERT INTO projects (
        user_id,
        name,
        description,
        address,
        latitude,
        longitude
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id as customer_id, name, description, address, latitude, longitude, created_at, updated_at
    `,
    [
      input.user_id,
      input.name,
      input.description,
      input.address,
      input.latitude,
      input.longitude,
    ],
  );

  return project;
}

async function updateProjectService(
  ctx: Context,
  id: string,
  input: {
    customer_id?: string;
    name?: string;
    description?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
) {
  const db = ctx.database!;
  const updateQueryArray = [];

  if (input.customer_id !== undefined) updateQueryArray.push('user_id = $customer_id');

  if (input.name !== undefined) updateQueryArray.push('name = $name');

  if (input.description !== undefined) updateQueryArray.push('description = $description');

  if (input.address !== undefined) updateQueryArray.push('address = $address');

  if (input.latitude !== undefined) updateQueryArray.push('latitude = $latitude');

  if (input.longitude !== undefined) updateQueryArray.push('longitude = $longitude');

  if (!updateQueryArray.length) throw new ServerError('No updatable fields provided');

  updateQueryArray.push('updated_at = now()');

  const updated = await db.namedQueryOne(
    `
      UPDATE projects
      SET ${updateQueryArray.join(', ')}
      WHERE id = $id
      RETURNING id, user_id as customer_id, name, description, address, latitude, longitude, created_at, updated_at
    `,
    {
      id,
      customer_id: input.customer_id,
      name: input.name,
      description: input.description,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  );

  return updated;
}

async function deleteProjectService(
  ctx: Context,
  id: string,
) {
  const db = ctx.database!;

  try {
    await db.begin();

    await db.query(
      `
        UPDATE devices
        SET project_id = NULL, updated_at = NOW()
        WHERE project_id = $1
      `,
      [id],
    );

    const deletedProject = await db.queryOne(
      `
        DELETE FROM projects
        WHERE id = $1
        RETURNING id
      `,
      [id],
    );

    await db.commit();
    return deletedProject;
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

export const createProject = RegisterService(createProjectService);
export const updateProject = RegisterService(updateProjectService);
export const deleteProject = RegisterService(deleteProjectService);

