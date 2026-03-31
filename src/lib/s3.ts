import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

const hasS3Config =
  !!env.S3_BUCKET && !!env.S3_ACCESS_KEY_ID && !!env.S3_SECRET_ACCESS_KEY;

export const s3Client = hasS3Config
  ? new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!
      },
      forcePathStyle: !!env.S3_ENDPOINT
    })
  : null;

export async function uploadImageToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  if (!s3Client || !env.S3_BUCKET) {
    throw new Error("S3 is not configured");
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );

  if (env.S3_PUBLIC_URL_BASE) {
    return `${env.S3_PUBLIC_URL_BASE.replace(/\/$/, "")}/${key}`;
  }

  if (env.S3_ENDPOINT) {
    return `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}/${key}`;
  }

  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}
