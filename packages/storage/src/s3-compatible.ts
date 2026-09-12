import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStorage, PutObjectInput, StoredObject } from "@ai-gen-free/core";

export type S3CompatibleConfig = {
  driver: "minio" | "s3" | "r2";
  endpoint?: string;
  publicEndpoint?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket: string;
  forcePathStyle: boolean;
};

export class S3CompatibleStorage implements ObjectStorage {
  readonly driver: string;
  private readonly bucket: string;
  private readonly autoCreateBucket: boolean;
  private readonly internal: S3Client;
  private readonly signing: S3Client;
  private bucketReady = false;

  constructor(config: S3CompatibleConfig) {
    this.driver = config.driver;
    this.bucket = config.bucket;
    this.autoCreateBucket = config.driver === "minio";
    if (
      (config.driver === "r2" || config.driver === "s3") &&
      (!config.accessKeyId?.trim() || !config.secretAccessKey?.trim())
    ) {
      throw new Error(
        `STORAGE_ACCESS_KEY dan STORAGE_SECRET_KEY wajib untuk driver "${config.driver}". Buat di Cloudflare Dashboard → R2 → API Tokens → Create Account API token (Object Read & Write). Secret hanya tampil sekali. Isi .env lalu recreate worker/api. Docs: https://developers.cloudflare.com/r2/api/tokens/`,
      );
    }
    this.internal = makeClient(config, config.endpoint);
    this.signing = makeClient(config, config.publicEndpoint ?? config.endpoint);
  }

  async put(input: PutObjectInput): Promise<void> {
    await this.ensureBucket();
    await this.internal.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async get(key: string): Promise<StoredObject> {
    const res = await this.internal.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error(`Empty object body: ${key}`);
    return {
      key,
      body: await res.Body.transformToByteArray(),
      contentType: res.ContentType ?? "application/octet-stream",
    };
  }

  async delete(key: string): Promise<void> {
    await this.internal.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signGetUrl(key: string, expiresSeconds = 600): Promise<string> {
    return getSignedUrl(this.signing, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresSeconds,
    });
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;
    try {
      await this.internal.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketReady = true;
    } catch (err) {
      if (!this.autoCreateBucket) throw err;
      await this.internal.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.bucketReady = true;
    }
  }
}

function makeClient(config: S3CompatibleConfig, endpoint?: string): S3Client {
  const credentials =
    config.accessKeyId && config.secretAccessKey
      ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
      : undefined;
  return new S3Client({
    region: config.region,
    endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials,
    // AWS SDK v3 default CRC32 checksum ditolak R2.
    ...(config.driver === "r2"
      ? { requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" }
      : {}),
  });
}
