import http from 'http';
import env from './config/env.js';
import app from './app.js';
import Logger from './service/logger/index.js';
import Socket from '@/socket.js';
import { connectDependencies } from '@/etc/connectDependencies.js';
import { withStartupRetry } from '@/utility/retry.js';

const { port, env: envName } = env;

const server = http.createServer(app);

async function startServer(): Promise<void> {
  await connectDependencies();
  await withStartupRetry('Socket.IO', () => Socket.init(server));

  server.listen(port, () => {
    Logger.info(`Server is running on port ${port} in ${envName} mode`);
  });
}

startServer().catch((error) => {
  Logger.error('Server failed to start', error);
  process.exit(1);
});
