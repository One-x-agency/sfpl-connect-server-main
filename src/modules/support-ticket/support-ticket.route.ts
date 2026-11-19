import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import permission from '@/middleware/auth/permission.js';

import {
  Controller as listSupportTickets,
  ValidationSchema as listSupportTicketsValidationSchema,
} from '@/modules/support-ticket/controllers/listSupportTickets.js';
import {
  Controller as getSupportTicket,
  ValidationSchema as getSupportTicketValidationSchema,
} from '@/modules/support-ticket/controllers/getSupportTicket.js';
import {
  Controller as updateSupportTicket,
  ValidationSchema as updateSupportTicketValidationSchema,
} from '@/modules/support-ticket/controllers/updateSupportTicket.js';
import {
  Controller as addSupportTicketRemark,
  ValidationSchema as addSupportTicketRemarkValidationSchema,
} from '@/modules/support-ticket/controllers/addSupportTicketRemark.js';
import {
  Controller as sendSupportTicketCloseOtp,
  ValidationSchema as sendSupportTicketCloseOtpValidationSchema,
} from '@/modules/support-ticket/controllers/sendSupportTicketCloseOtp.js';

const router = Router();

const ticketStaff = permission('admin', 'support');

router.route('/')
  .get(ticketStaff, validate(listSupportTicketsValidationSchema), withDatabase(listSupportTickets));

router.route('/:ticket_id')
  .get(ticketStaff, validate(getSupportTicketValidationSchema), withDatabase(getSupportTicket))
  .patch(ticketStaff, validate(updateSupportTicketValidationSchema), withDatabase(updateSupportTicket));

router.route('/:ticket_id/remarks')
  .post(ticketStaff, validate(addSupportTicketRemarkValidationSchema), withDatabase(addSupportTicketRemark));

router.route('/:ticket_id/close/send-otp')
  .post(ticketStaff, validate(sendSupportTicketCloseOtpValidationSchema), withDatabase(sendSupportTicketCloseOtp));

export default router;
