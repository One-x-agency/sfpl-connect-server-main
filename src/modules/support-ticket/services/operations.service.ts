import type { Context } from '@/core/registerService.js';
import ServerError from '@/core/serverError.class.js';
import RegisterService from '@/core/registerService.js';
import RedisClient from '@/service/redis/index.js';
import Logger from '@/service/logger/index.js';
import { sendMail } from '@/service/mail/index.js';
import ticketCloseOtpEmail from '@/utility/emailTemplates/ticketCloseOtpEmail.js';
import { logActivity } from '@/modules/activity-log/services/activity-log.service.js';
import { type TicketStatus } from '@/modules/support-ticket/constants/ticket-status.js';

type UpdateTicketInput = { status?: TicketStatus; otp?: string };
type AddRemarkInput = { remark: string; created_by: string };

const TICKET_CLOSE_OTP_TTL_SECONDS = 10 * 60;

const attachmentSelect = `
  COALESCE((
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
  ), '[]'::jsonb) AS attachments`;

const ticketColumns = `
  t.id, t.customer_id, t.serial_number, t.serial, t.title, t.description, t.status, t.remark,
  t.created_at, t.updated_at, t.closed_at,
  u.name AS customer_name, u.email AS customer_email, u.phone_number AS customer_phone`;

const ticketJoin = `
  FROM support_tickets t
  JOIN users u ON u.id = t.customer_id`;

const ticketCloseOtpRedisKey = (ticketId: string) => `ticket-close-otp:${ticketId}`;

async function ensureRedisReady() {
  if (!RedisClient.isOpen) await RedisClient.connect();
}

async function getTicketMeta(db: Context['database'], ticketId: string) {
  return db!.namedQueryOne<{ id: string; status: TicketStatus; serial: string }>(
    'SELECT id, status, serial FROM support_tickets WHERE id = $ticket_id',
    { ticket_id: ticketId },
  );
}

async function listTicketRemarks(db: Context['database'], ticketId: string) {
  return db!.namedQueryAll(
    `SELECT r.id, r.ticket_id, r.remark, r.created_by, r.created_at,
            u.name AS created_by_name, u.email AS created_by_email
     FROM support_ticket_remarks r
     JOIN users u ON u.id = r.created_by
     WHERE r.ticket_id = $ticket_id
     ORDER BY r.created_at DESC`,
    { ticket_id: ticketId },
  );
}

async function touchTicket(db: Context['database'], ticketId: string) {
  await db!.namedQueryOne(
    'UPDATE support_tickets SET updated_at = now() WHERE id = $ticket_id RETURNING id',
    { ticket_id: ticketId },
  );
}

async function getSupportTicketByIdService(ctx: Context, ticketId: string) {
  const db = ctx.database!;
  const ticket = await db.namedQueryOne(
    `SELECT ${ticketColumns}, ${attachmentSelect} ${ticketJoin} WHERE t.id = $ticket_id`,
    { ticket_id: ticketId },
  );

  if (!ticket) return null;

  return { ...ticket, remarks: await listTicketRemarks(db, ticketId) };
}

async function listSupportTicketsService(
  ctx: Context,
  options: {
    offset?: number;
    limit?: number;
    status?: TicketStatus;
    customer_id?: string;
    search?: string;
  } = {},
) {
  const db = ctx.database!;
  const conditions: string[] = [];
  const params: Record<string, unknown> = {
    offset: options.offset ?? 0,
    limit: options.limit ?? 30,
  };

  if (options.status) {
    params.status = options.status;
    conditions.push('t.status = $status');
  }

  if (options.customer_id) {
    params.customer_id = options.customer_id;
    conditions.push('t.customer_id = $customer_id');
  }

  if (options.search) {
    params.search = `%${options.search}%`;
    conditions.push(`(
      t.serial ILIKE $search OR t.title ILIKE $search
      OR u.name ILIKE $search OR u.email ILIKE $search OR u.phone_number ILIKE $search
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return db.namedQueryAll(
    `SELECT ${ticketColumns},
            (SELECT COUNT(*)::int FROM support_ticket_attachments sta WHERE sta.ticket_id = t.id) AS attachment_count,
            (SELECT COUNT(*)::int FROM support_ticket_remarks r WHERE r.ticket_id = t.id) AS remark_count
     ${ticketJoin}
     ${whereClause}
     ORDER BY t.created_at DESC
     OFFSET $offset LIMIT $limit`,
    params,
  );
}

async function updateSupportTicketService(
  ctx: Context,
  ticketId: string,
  input: UpdateTicketInput,
  actorUserId: string,
) {
  const db = ctx.database!;
  const existing = await getTicketMeta(db, ticketId);

  if (!existing) throw new ServerError('Ticket not found.');

  if (input.status === undefined) throw new ServerError('No fields to update.');

  if (existing.status === 'closed' && input.status === 'open') {
    throw new ServerError('Reopening closed tickets is not supported.');
  }

  if (input.status === 'closed') {
    if (!input.otp) throw new ServerError('OTP is required to close ticket.');

    await ensureRedisReady();
    const redisKey = ticketCloseOtpRedisKey(ticketId);
    const storedOtp = await RedisClient.get(redisKey);

    if (!storedOtp || String(storedOtp).trim() !== input.otp.trim()) {
      throw new ServerError('Invalid or expired OTP');
    }

    await RedisClient.del(redisKey);
  }

  const updates = ['status = $status', 'updated_at = now()'];
  const params: Record<string, unknown> = { ticket_id: ticketId, status: input.status };

  if (input.status === 'closed') updates.push('closed_at = now()');

  await db.namedQueryOne(
    `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $ticket_id RETURNING id`,
    params,
  );

  if (input.status === 'closed') {
    await logActivity(db, {
      userId: actorUserId,
      module: 'support_tickets',
      action: 'status_change',
      entityId: ticketId,
      entityLabel: existing.serial,
      metadata: { from_status: existing.status, to_status: 'closed' },
    });
  }

  return getSupportTicketByIdService(ctx, ticketId);
}

async function addSupportTicketRemarkService(
  ctx: Context,
  ticketId: string,
  input: AddRemarkInput,
) {
  const db = ctx.database!;
  const existing = await getTicketMeta(db, ticketId);

  if (!existing) throw new ServerError('Ticket not found.');
  if (existing.status === 'closed') throw new ServerError('Remarks cannot be added to closed tickets.');

  const remark = input.remark.trim();
  if (!remark) throw new ServerError('Remark is required.');

  const created = await db.namedQueryOne(
    `INSERT INTO support_ticket_remarks (ticket_id, remark, created_by)
     VALUES ($ticket_id, $remark, $created_by)
     RETURNING id, ticket_id, remark, created_by, created_at`,
    { ticket_id: ticketId, remark, created_by: input.created_by },
  );

  await touchTicket(db, ticketId);

  await logActivity(db, {
    userId: input.created_by,
    module: 'support_tickets',
    action: 'update',
    entityId: ticketId,
    entityLabel: existing.serial,
    metadata: { event: 'remark_added' },
    changes: { remark },
  });

  return created;
}

async function sendSupportTicketCloseOtpService(
  ctx: Context,
  ticketId: string,
  actorUserId: string,
) {
  const db = ctx.database!;
  const ticket = await db.namedQueryOne<{
    id: string;
    status: TicketStatus;
    serial: string;
    customer_name: string | null;
    customer_email: string | null;
  }>(
    `SELECT t.id, t.status, t.serial, u.name AS customer_name, u.email AS customer_email
     ${ticketJoin}
     WHERE t.id = $ticket_id`,
    { ticket_id: ticketId },
  );

  if (!ticket) throw new ServerError('Ticket not found.');
  if (ticket.status !== 'open') throw new ServerError('OTP can only be sent for open tickets.');

  const email = ticket.customer_email?.trim();
  if (!email) throw new ServerError('Customer email is required to send OTP.');

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const redisKey = ticketCloseOtpRedisKey(ticketId);

  await ensureRedisReady();
  await RedisClient.set(redisKey, otp, { EX: TICKET_CLOSE_OTP_TTL_SECONDS });

  try {
    await sendMail({
      to: email,
      subject: 'SFPL support ticket close verification code',
      html: ticketCloseOtpEmail({
        otp,
        customerName: ticket.customer_name,
        ticketSerial: ticket.serial,
      }),
    });
  } catch (error) {
    await RedisClient.del(redisKey);
    const message = error instanceof Error ? error.message : 'Unknown email error';
    throw new ServerError(`Failed to send OTP email: ${message}`);
  }

  Logger.info(`Ticket close OTP generated for ${ticketId} and emailed to ${email}`);

  await logActivity(db, {
    userId: actorUserId,
    module: 'support_tickets',
    action: 'otp_sent',
    entityId: ticketId,
    entityLabel: ticket.serial,
    metadata: { sent_to: email, purpose: 'close_ticket' },
  });

  return { sent_to: email, customer_name: ticket.customer_name ?? null, otp };
}

export const getSupportTicketById = RegisterService(getSupportTicketByIdService);
export const listSupportTickets = RegisterService(listSupportTicketsService);
export const updateSupportTicket = RegisterService(updateSupportTicketService);
export const addSupportTicketRemark = RegisterService(addSupportTicketRemarkService);
export const sendSupportTicketCloseOtp = RegisterService(sendSupportTicketCloseOtpService);
