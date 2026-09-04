import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function clientOptions(endpoint: string) {
  return {
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "minio",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "minio12345",
    },
  };
}

function internalEndpoint() {
  return process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000";
}

function publicEndpoint() {
  return process.env.S3_PUBLIC_ENDPOINT ?? internalEndpoint();
}

function client() {
  return new S3Client(clientOptions(internalEndpoint()));
}

function signingClient() {
  return new S3Client(clientOptions(publicEndpoint()));
}

export function bucketName() {
  return process.env.S3_BUCKET ?? "generations";
}

export async function ensureBucket() {
  const s3 = client();
  const Bucket = bucketName();
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket }));
  }
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await ensureBucket();
  await client().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function signedGetUrl(key: string, expiresSeconds = 10 * 60) {
  return getSignedUrl(
    signingClient(),
    new GetObjectCommand({ Bucket: bucketName(), Key: key }),
    { expiresIn: expiresSeconds },
  );
}

export async function getObjectBytes(key: string): Promise<{ bytes: Uint8Array; contentType?: string }> {
  const res = await client().send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
  if (!res.Body) {
    throw new Error("empty object body");
  }
  return {
    bytes: await res.Body.transformToByteArray(),
    contentType: res.ContentType,
  };
}
