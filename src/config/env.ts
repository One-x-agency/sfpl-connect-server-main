import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({
  path: path.join(__dirname, '../../.env'),
  override: true,
});


if (!process.env.DATABASE_URL) throw new Error('ENV: DATABASE_URL is not found in the environment variables');

function parseDatabaseUrl(databaseUrl: string) {

  const url = new URL(databaseUrl);

  const host = url.hostname;
  const port = url.port || '5432';
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const database = url.pathname.slice(1); // Remove leading '/'

  const sslModeParam = url.searchParams.get('sslmode');
  let sslMode = false;
  if (sslModeParam) sslMode = sslModeParam === 'require' || sslModeParam === 'true' || sslModeParam === 'enable';
  else sslMode = process.env.DB_SSL_MODE === 'true';

  return {
    host: host,
    port: port,
    user: user,
    password: password,
    database: database,
    sslMode,
  };

}



const env = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.SERVER_PORT || 3007,
  serviceName: process.env.SERVICE_NAME || 'e-commerce',
  jwtSecret: process.env.JWT_SECRET,
  fileStorageEndpoint: process.env.FILE_STORAGE_ENDPOINT || 'http://localhost:3007/files',

  fileStoragePath: process.env.FILE_STORAGE_PATH || path.join(__dirname, '../../files'),

  database: parseDatabaseUrl(process.env.DATABASE_URL),

  redis: {
    url : process.env.REDIS_URL || 'redis://localhost:6379',
  },

  logger : {
    consoleLogLevel: process.env.CONSOLE_LOG_LEVEL || 'info',
    fileLogLevel: process.env.FILE_LOG_LEVEL || 'false',
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    s3Bucket: process.env.AWS_S3_BUCKET,
    s3BackupBucket: process.env.AWS_S3_BACKUP_BUCKET,
  },

  /** Cold archive for device_logs — see src/etc/cron/scripts/archiveDeviceLogsToS3.script.ts */
  deviceLogArchive: {
    s3Bucket: process.env.DEVICE_LOG_ARCHIVE_S3_BUCKET || '',
    s3Prefix: process.env.DEVICE_LOG_ARCHIVE_S3_PREFIX || 'device-logs-archive',
    keepMonths: Math.max(1, parseInt(process.env.DEVICE_LOG_ARCHIVE_KEEP_MONTHS || '3', 10) || 3),
    tz: process.env.DEVICE_LOG_ARCHIVE_TZ || 'UTC',
    dryRun: process.env.DEVICE_LOG_ARCHIVE_DRY_RUN === '1',
    forceReexport: process.env.DEVICE_LOG_ARCHIVE_FORCE_REEXPORT === '1',
    deleteBatch: Math.max(1, parseInt(process.env.DEVICE_LOG_ARCHIVE_DELETE_BATCH || '10000', 10) || 10000),
    s3Retries: Math.max(1, parseInt(process.env.DEVICE_LOG_ARCHIVE_S3_RETRIES || '3', 10) || 3),
    /** Mirror into AWS_S3_BACKUP_BUCKET under csv_backup/{database}_{timestamp}/ — see backupDeviceLogArchiveToS3.script.ts */
    backupS3Key: process.env.DEVICE_LOG_ARCHIVE_BACKUP_S3_KEY || 'csv_backup',
    backupDryRun: process.env.DEVICE_LOG_ARCHIVE_BACKUP_DRY_RUN === '1',
    backupForceRecopy: process.env.DEVICE_LOG_ARCHIVE_BACKUP_FORCE_RECOPY === '1',
    backupCopyRetries: Math.max(1, parseInt(process.env.DEVICE_LOG_ARCHIVE_BACKUP_COPY_RETRIES || '3', 10) || 3),
    backupListPageSize: Math.min(
      1000,
      Math.max(1, parseInt(process.env.DEVICE_LOG_ARCHIVE_BACKUP_LIST_PAGE_SIZE || '500', 10) || 500),
    ),
    backupRetentionCount: Math.max(
      1,
      parseInt(process.env.DEVICE_LOG_ARCHIVE_BACKUP_RETENTION_COUNT || '5', 10) || 5,
    ),
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },

  google: {
    webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
  },

  developerEmail: process.env.DEVELOPER_EMAIL || 'contact@rajraiyani.com',
  deviceConfigurationUrl: process.env.DEVICE_CONFIGURATION_URL,

  mqtt: {
    clientId: process.env.MQTT_CLIENT_ID,
    host: process.env.MQTT_HOST || 'localhost',
    port: process.env.MQTT_PORT || 1883,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  },

  emqx: {
    apiKey: process.env.EMQX_API_KEY,
    apiSecret: process.env.EMQX_API_SECRET,
    apiPort: process.env.EMQX_API_PORT || '18083',
  },

  apple: {
    bundleId: process.env.APPLE_BUNDLE_ID,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    webChatSecret: process.env.WEB_CHAT_SECRET || '',
    maxOutputTokens: Math.max(64, parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || '450', 10) || 450),
    maxContextChars: Math.max(500, parseInt(process.env.OPENAI_MAX_CONTEXT_CHARS || '3200', 10) || 3200),
    topK: Math.max(1, parseInt(process.env.OPENAI_TOP_K || '3', 10) || 3),
    minRetrievalScore: Number(process.env.OPENAI_MIN_RETRIEVAL_SCORE || '1.2') || 1.2,
    timeoutMs: Math.max(5000, parseInt(process.env.OPENAI_TIMEOUT_MS || '20000', 10) || 20000),
    rateLimitMax: Math.max(1, parseInt(process.env.OPENAI_RATE_LIMIT_MAX || '20', 10) || 20),
    rateLimitWindowMs: Math.max(1000, parseInt(process.env.OPENAI_RATE_LIMIT_WINDOW_MS || '60000', 10) || 60000),
    cacheTtlSeconds: Math.max(60, parseInt(process.env.OPENAI_CACHE_TTL_SECONDS || '86400', 10) || 86400),
  },
};



export default env;
