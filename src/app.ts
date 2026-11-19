import '@/etc/serverEnvCheck.js';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import Logger from './service/logger/index.js';
import errorHandler from './middleware/errorHandler.js';
import appRoute from './app.route.js';
import receiverRoute from './modules/receiver/receiver.route.js';
import customerPortalRoute from '@/modules/customer-portal/customer-portal.route.js';
import storeRoutes from '@/modules/customer-portal/store/store.route.js';
import chatRoutes from '@/modules/chat/chat.route.js';
import cookieParser from 'cookie-parser';
import env from './config/env.js';
import { heartbeatHandler } from './etc/heartbeat.js';
import '@/modules/receiver/receiver.init.js';
import '@/modules/custom-notification-schema/custom-notification-schema.init.js';
import '@/modules/notification/notification.init.js';
import '@/modules/customer/customer.init.js';
import '@/modules/file/file.init.js';
import '@/etc/cron/index.js';
import '@/mqttClient.js';
import '@/modules/device/device.init.js';



const app = express();

// Dynamic API responses should not use ETags; 304 responses have no body and break clients.
app.set('etag', false);

app.use(morgan(':method :url Status : :status, Time taken: :response-time ms', {
  stream: { write: (message) => Logger.info(message) },
}));

app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
const serverStartTimeStamp = new Date().toISOString();

// Status route
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    version: '1.0.0',
    startTime: serverStartTimeStamp,
    service: env.serviceName,
    codeSign: 'R.P.Raiyani',
    author: 'rajraiyani.com',
  });
});

app.get('/ping', (req, res) => {
  res.status(200).send('pont');
});

app.get('/heartbeat', heartbeatHandler);

app.use('/', appRoute);

app.use('/', receiverRoute);

app.use('/customer-portal', customerPortalRoute);

app.use('/storefront', storeRoutes);

app.use('/', chatRoutes);

// Error handler 1
app.use(errorHandler);

export default app;
