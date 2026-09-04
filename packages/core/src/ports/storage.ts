export type PutObjectInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
};

export type StoredObject = {
  key: string;
  body: Uint8Array;
  contentType: string;
};

/**
 * Port objek. Wallet, job, dan worker bergantung ke ini — bukan SDK S3/R2.
 * Driver baru = adapter baru + registerStorageDriver, bukan if di service.
 */
export interface ObjectStorage {
  readonly driver: string;
  put(input: PutObjectInput): Promise<void>;
  get(key: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  signGetUrl(key: string, expiresSeconds?: number): Promise<string>;
}

export type ObjectStorageDriver = "minio" | "s3" | "r2" | "memory" | (string & {});

export type ObjectStorageParams = {
  driver: ObjectStorageDriver;
  endpoint?: string;
  publicEndpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  forcePathStyle?: boolean;
  signedUrlExpiresSeconds?: number;
};
