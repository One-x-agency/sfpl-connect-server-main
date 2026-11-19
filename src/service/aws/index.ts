import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import env from '@/config/env.js';

export const s3 = new S3Client({
  region: env.aws.region,
  credentials: {
    accessKeyId: env.aws.accessKeyId ?? '',
    secretAccessKey: env.aws.secretAccessKey ?? '',
  },
});

const DEFAULT_DOWNLOAD_TTL_SEC = 900;

export async function getPresignedDownloadUrl(
  bucket: string,
  key: string,
  expiresInSec = DEFAULT_DOWNLOAD_TTL_SEC,
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSec },
  );
}

