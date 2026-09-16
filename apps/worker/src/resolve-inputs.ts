import sharp from "sharp";
import { prisma } from "@ai-gen-free/db";
import type { ObjectStorage } from "@ai-gen-free/core";
import type { FetchedBytes } from "./fetch-output.js";

export async function resolveInputImages(opts: {
  userId: string;
  params: Record<string, unknown>;
  storage: ObjectStorage;
  fetchBytes: (url: string) => Promise<FetchedBytes>;
}): Promise<{ image?: string; images?: string[] }> {
  const rawRefs: string[] = [];

  if (typeof opts.params.image === "string" && opts.params.image.trim()) {
    rawRefs.push(opts.params.image.trim());
  }

  if (Array.isArray(opts.params.images)) {
    for (const item of opts.params.images) {
      if (typeof item === "string" && item.trim() && !rawRefs.includes(item.trim())) {
        rawRefs.push(item.trim());
      }
    }
  }

  if (Array.isArray(opts.params.refs)) {
    for (const item of opts.params.refs) {
      const refStr =
        typeof item === "string"
          ? item.trim()
          : typeof item === "object" && item !== null && typeof (item as { url?: unknown }).url === "string"
            ? (item as { url: string }).url.trim()
            : "";
      if (refStr && !rawRefs.includes(refStr)) {
        rawRefs.push(refStr);
      }
    }
  }

  if (rawRefs.length === 0) {
    return {};
  }

  const resolvedDataUrls: string[] = [];

  for (const ref of rawRefs) {
    try {
      const dataUrl = await resolveSingleImageToDataUrl({
        userId: opts.userId,
        ref,
        storage: opts.storage,
        fetchBytes: opts.fetchBytes,
      });
      if (dataUrl) {
        resolvedDataUrls.push(dataUrl);
      }
    } catch (err) {
      console.warn(`[resolveInputImages] Failed to resolve reference "${ref}":`, err);
    }
  }

  if (resolvedDataUrls.length === 0) {
    return {};
  }

  return {
    image: resolvedDataUrls[0],
    images: resolvedDataUrls,
  };
}

async function resolveSingleImageToDataUrl(opts: {
  userId: string;
  ref: string;
  storage: ObjectStorage;
  fetchBytes: (url: string) => Promise<FetchedBytes>;
}): Promise<string | null> {
  const { userId, ref, storage, fetchBytes } = opts;

  // 1. Sudah berformat Base64 Data URL
  if (ref.startsWith("data:image/")) {
    return ref;
  }

  let imageBytes: Uint8Array | null = null;

  // 2. Ekstrak jika merupakan referensi Upload (up_... atau up-...)
  const uploadIdMatch = ref.match(/(up_[a-f0-9]+|up-[a-f0-9-]+)/i);
  if (uploadIdMatch) {
    const uploadId = uploadIdMatch[1];
    // Coba storage key default upload
    const keyCandidates = [
      `uploads/customer/${userId}/${uploadId}.webp`,
      `uploads/admin/${userId}/${uploadId}.webp`,
    ];
    for (const key of keyCandidates) {
      try {
        const obj = await storage.get(key);
        if (obj && obj.body) {
          imageBytes = obj.body;
          break;
        }
      } catch {}
    }

    if (!imageBytes) {
      try {
        const row = await prisma.upload.findFirst({
          where: { id: uploadId, userId },
          select: { storageKey: true },
        });
        if (row?.storageKey) {
          const obj = await storage.get(row.storageKey);
          if (obj?.body) imageBytes = obj.body;
        }
      } catch {}
    }
  }

  // 3. Ekstrak jika merupakan referensi Job Generate sebelumnya (c[a-z0-9]{24})
  if (!imageBytes) {
    const jobIdMatch = ref.match(/(c[a-z0-9]{24})/i);
    if (jobIdMatch) {
      const jobId = jobIdMatch[1];
      const keyCandidates = [
        `outputs/${userId}/${jobId}.webp`,
        `outputs/${jobId}.webp`,
      ];
      for (const key of keyCandidates) {
        try {
          const obj = await storage.get(key);
          if (obj && obj.body) {
            imageBytes = obj.body;
            break;
          }
        } catch {}
      }

      if (!imageBytes) {
        try {
          const row = await prisma.jobAsset.findFirst({
            where: { jobId, kind: "output" },
            select: { storageKey: true },
          });
          if (row?.storageKey) {
            const obj = await storage.get(row.storageKey);
            if (obj?.body) imageBytes = obj.body;
          }
        } catch {}
      }
    }
  }

  // 4. Jika merupakan URL HTTP/HTTPS publik
  if (!imageBytes && /^https?:\/\//i.test(ref)) {
    try {
      const fetched = await fetchBytes(ref);
      if (fetched && fetched.body) {
        imageBytes = fetched.body;
      }
    } catch {}
  }

  if (!imageBytes || imageBytes.length === 0) {
    return null;
  }

  // Konversi ke PNG Buffer yang valid untuk OpenAI / Siray API
  try {
    const pngBuffer = await sharp(Buffer.from(imageBytes)).png().toBuffer();
    return `data:image/png;base64,${pngBuffer.toString("base64")}`;
  } catch {
    // Fallback jika sharp gagal parsing, gunakan base64 langsung
    return `data:image/png;base64,${Buffer.from(imageBytes).toString("base64")}`;
  }
}
