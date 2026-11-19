export const TICKET_STATUSES = ['open', 'closed'] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const MAX_OPEN_TICKETS_PER_CUSTOMER = 10;
export const MAX_TICKET_ATTACHMENTS = 5;
