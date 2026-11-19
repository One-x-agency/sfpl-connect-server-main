import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';
import validate from '@/middleware/requestValidator.js';

import {
  Controller as listTickets,
  ValidationSchema as listTicketsValidationSchema,
} from '@/modules/customer-portal/support-ticket/controllers/listTickets.js';
import {
  Controller as createTicket,
  ValidationSchema as createTicketValidationSchema,
} from '@/modules/customer-portal/support-ticket/controllers/createTicket.js';
import {
  Controller as getTicket,
  ValidationSchema as getTicketValidationSchema,
} from '@/modules/customer-portal/support-ticket/controllers/getTicket.js';

const router = Router();

router.use(requireCustomerAuth);

router.route('/')
  .get(validate(listTicketsValidationSchema), withDatabase(listTickets))
  .post(validate(createTicketValidationSchema), withDatabase(createTicket));

router.route('/:ticket_id')
  .get(validate(getTicketValidationSchema), withDatabase(getTicket));

export default router;
