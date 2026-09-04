import type { ObjectStorage, PutObjectInput, StoredObject } from "@ai-gen-free/core";

export class MemoryObjectStorage implements ObjectStorage {
  readonly driver = "memory";
  private readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async put(input: PutObjectInput): Promise<void> {
    this.objects.set(input.key, {
      body: Uint8Array.from(input.body),
      contentType: input.contentType,
    });
  }

  async get(key: string): Promise<StoredObject> {
    const found = this.objects.get(key);
    if (!found) throw new Error(`Object not found: ${key}`);
    return { key, body: found.body, contentType: found.contentType };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async signGetUrl(key: string, expiresSeconds = 600): Promise<string> {
    const found = this.objects.get(key);
    if (!found) throw new Error(`Object not found: ${key}`);
    const expiresAt = Date.now() + expiresSeconds * 1000;
    const b64 = Buffer.from(found.body).toString("base64");
    return `data:${found.contentType};base64,${b64}#expires=${expiresAt}`;
  }
}
