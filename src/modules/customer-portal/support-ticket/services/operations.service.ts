import type { Context } from '@/core/registerService.js';
import ServerError from '@/core/serverError.class.js';
import RegisterService from '@/core/registerService.js';
import {
  MAX_OPEN_TICKETS_PER_CUSTOMER,
  MAX_TICKET_ATTACHMENTS,
  type TicketStatus,
} from '@/modules/customer-portal/support-ticket/constants/ticket-status.js';

type CreateTicketInput = {
  customer_id: string;
  title: string;
  description: string;
  file_ids?: string[];
};

const attachmentSelect = `
  COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', sta.id,
        'file_id', f.id,
        'key', f.key,
        'url', f.url,
        'created_at', sta.created_at
      )
      ORDER BY sta.created_at ASC
    )
    FROM support_ticket_attachments sta
    JOIN files f ON f.id = sta.file_id
    WHERE sta.ticket_id = t.id
  ),
  '[]'::jsonb
) AS attachments
`;

async function assertOpenTicketLimit(ctx: Context, customerId: string) {
  const db = ctx.database!;
  const row = await db.queryOne<{ count: number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM support_tickets
      WHERE customer_id = $1
        AND status = 'open'
    `,
    [customerId],
  );

  if ((row?.count ?? 0) >= MAX_OPEN_TICKETS_PER_CUSTOMER) {
    throw new ServerError(
      `You can have at most ${MAX_OPEN_TICKETS_PER_CUSTOMER} open tickets. Close an existing ticket before creating a new one.`,
    );
  }
}

async function validateFileIds(ctx: Context, fileIds: string[] | undefined) {
  if (!fileIds?.length) return;

  const db = ctx.database!;

  if (fileIds.length > MAX_TICKET_ATTACHMENTS) {
    throw new ServerError(`A ticket can have at most ${MAX_TICKET_ATTACHMENTS} attachments.`);
  }

  const uniqueIds = [...new Set(fileIds)];
  if (uniqueIds.length !== fileIds.length) {
    throw new ServerError('Duplicate attachment file IDs are not allowed.');
  }

  const files = await db.queryAll<{ id: string }>(
    'SELECT id FROM files WHERE id = ANY($1::uuid[])',
    [uniqueIds],
  );

  if (files.length !== uniqueIds.length) {
    throw new ServerError('One or more attachment files were not found.');
  }
}

async function createSupportTicketService(
  ctx: Context,
  input: CreateTicketInput,
) {
  const db = ctx.database!;

  await assertOpenTicketLimit(ctx, input.customer_id);
  await validateFileIds(ctx, input.file_ids);

  const ticket = await db.queryOne(
    `
      INSERT INTO support_tickets (
        customer_id,
        title,
        description
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        customer_id,
        serial_number,
        serial,
        title,
        description,
        status,
        created_at,
        updated_at,
        closed_at
    `,
    [input.customer_id, input.title, input.description],
  );

  if (!ticket) {
    throw new ServerError('Failed to create ticket.');
  }

  if (input.file_ids?.length) {
    for (const fileId of input.file_ids) {
      await db.queryOne(
        `
          INSERT INTO support_ticket_attachments (ticket_id, file_id)
          VALUES ($1, $2)
        `,
        [ticket.id, fileId],
      );
    }
  }

  return getSupportTicketByIdService(ctx, ticket.id as string, input.customer_id);
}

async function getSupportTicketByIdService(
  ctx: Context,
  ticketId: string,
  customerId: string,
) {
  const db = ctx.database!;

  return db.queryOne(
    `
      SELECT
        t.id,
        t.customer_id,
        t.serial_number,
        t.serial,
        t.title,
        t.description,
        t.status,
        t.created_at,
        t.updated_at,
        t.closed_at,
        ${attachmentSelect}
      FROM support_tickets t
      WHERE t.id = $1
        AND t.customer_id = $2
    `,
    [ticketId, customerId],
  );
}

async function listSupportTicketsService(
  ctx: Context,
  customerId: string,
  options: { offset?: number; limit?: number; status?: TicketStatus } = {},
) {
  const db = ctx.database!;
  const values: unknown[] = [customerId];
  const conditions = ['t.customer_id = $1'];

  if (options.status) {
    values.push(options.status);
    conditions.push(`t.status = $${values.length}`);
  }

  const offset = options.offset ?? 0;
  const limit = options.limit ?? 30;
  values.push(offset, limit);
  const offsetParam = values.length - 1;
  const limitParam = values.length;

  return db.queryAll(
    `
      SELECT
        t.id,
        t.customer_id,
        t.serial_number,
        t.serial,
        t.title,
        t.description,
        t.status,
        t.created_at,
        t.updated_at,
        t.closed_at,
        (
          SELECT COUNT(*)::int
          FROM support_ticket_attachments sta
          WHERE sta.ticket_id = t.id
        ) AS attachment_count
      FROM support_tickets t
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.created_at DESC
      OFFSET $${offsetParam} LIMIT $${limitParam}
    `,
    values,
  );
}

export const createSupportTicket = RegisterService(createSupportTicketService);
export const getSupportTicketById = RegisterService(getSupportTicketByIdService);
export const listSupportTickets = RegisterService(listSupportTicketsService);
