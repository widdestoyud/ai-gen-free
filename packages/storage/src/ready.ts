import type { ObjectStorage } from "@ai-gen-free/core";

/** Put kecil untuk memastikan R2/S3/MinIO terima tulis sebelum submit Siray. */
export async function assertStorageReady(storage: ObjectStorage): Promise<void> {
  const key = "healthcheck/ping.txt";
  await storage.put({
    key,
    body: new Uint8Array([111, 107]),
    contentType: "text/plain",
  });
}
