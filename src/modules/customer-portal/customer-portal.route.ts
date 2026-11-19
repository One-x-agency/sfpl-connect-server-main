import { Router } from 'express';
import authRoutes from '@/modules/customer-portal/auth/auth.route.js';
import projectRoutes from '@/modules/customer-portal/project/project.route.js';
import deviceRoutes from '@/modules/customer-portal/device/device.route.js';
import customNotificationRoutes from '@/modules/customer-portal/custom-notification/custom-notification.route.js';
import dashboardRoutes from '@/modules/customer-portal/dashboard/dashboard.route.js';
import notificationRoutes from '@/modules/customer-portal/notification/notification.route.js';
import portalUserRoutes from '@/modules/customer-portal/user/user.route.js';
import diagramRoutes from '@/modules/customer-portal/diagram/diagram.route.js';
import customerFileRoutes from '@/modules/customer-portal/file/file.route.js';
import metaDataRoutes from '@/modules/customer-portal/meta/meta.route.js';
import supportTicketRoutes from '@/modules/customer-portal/support-ticket/support-ticket.route.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', portalUserRoutes);
router.use('/projects', projectRoutes);
router.use('/devices', deviceRoutes);
router.use('/custom-notifications', customNotificationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/diagrams', diagramRoutes);
router.use('/files', customerFileRoutes);
router.use('/meta', metaDataRoutes);
router.use('/tickets', supportTicketRoutes);

export default router;
