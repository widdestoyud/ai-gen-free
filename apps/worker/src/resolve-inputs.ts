import sharp from "sharp";
import { prisma } from "@ai-gen-free/db";
import { isSafePublicUrl, type ObjectStorage } from "@ai-gen-free/core";
import type { FetchedBytes } from "./fetch-output.js";

export { isSafePublicUrl };

export const TEMPLATE_IMAGE_REF_PREFIX = "template-image:";
const TEMPLATE_IMAGE_REF_RE = /^template-image:(c[a-z0-9]{24})$/;

/** Mengekstrak ID `TemplateImage` (cuid) dari referensi kanonik `template-image:<id>`. */
export function parseTemplateImageRef(ref: string): string | null {
  const match = ref.match(TEMPLATE_IMAGE_REF_RE);
  return match ? match[1]! : null;
}

/** Memastikan aset template masih aktif dan sesuai izin mode Spicy pengguna. */
export function isTemplateRefAllowed(
  t: { isActive: boolean; isSpicy: boolean },
  userSpicyEnabled: boolean,
): boolean {
  if (!t.isActive) return false;
  if (t.isSpicy && !userSpicyEnabled) return false;
  return true;
}

export type ResolveInputsDb = {
  templateImage: {
    findUnique(args: {
      where: { id: string };
      include: { template: { select: { isActive: true; isSpicy: true } } };
    }): Promise<{
      storageKey: string;
      template: { isActive: boolean; isSpicy: boolean } | null;
    } | null>;
  };
  user: {
    findUnique(args: {
      where: { id: string };
      select: { spicyModeEnabled: true };
    }): Promise<{ spicyModeEnabled: boolean } | null>;
  };
  upload?: {
    findFirst(args: {
      where: { id: string; userId: string; deletedAt: null };
      select: { storageKey: true };
    }): Promise<{ storageKey: string } | null>;
  };
  jobAsset?: {
    findFirst(args: {
      where: { jobId: string; kind: "output"; job: { userId: string } };
      select: { storageKey: true };
    }): Promise<{ storageKey: string } | null>;
  };
};

const defaultResolveInputsDb: ResolveInputsDb = {
  templateImage: {
    findUnique: (args) => prisma.templateImage.findUnique(args),
  },
  user: {
    findUnique: (args) => prisma.user.findUnique(args),
  },
  upload: {
    findFirst: (args) => prisma.upload.findFirst(args),
  },
  jobAsset: {
    findFirst: (args) => prisma.jobAsset.findFirst(args),
  },
};

export async function getStoragePublicOrSignedUrl(storage: ObjectStorage, key: string): Promise<string> {
  const publicEndpoint = process.env.STORAGE_PUBLIC_ENDPOINT?.trim();
  if (publicEndpoint) {
    return `${publicEndpoint.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
  }
  if (typeof storage?.signGetUrl === "function") {
    try {
      return await storage.signGetUrl(key, 7200);
    } catch {}
  }
  return "";
}

export type ResolvedImageBuffer = {
  bytes: Uint8Array;
  contentType: string;
};

export async function resolveInputImages(opts: {
  userId: string;
  jobId?: string;
  params: Record<string, unknown>;
  storage: ObjectStorage;
  fetchBytes: (url: string) => Promise<FetchedBytes>;
  db?: ResolveInputsDb;
}): Promise<{ image?: string; images?: string[]; mask?: string; tempStorageKeys: string[] }> {
  const rawRefs: string[] = [];
  const tempStorageKeys: string[] = [];
  const jobId = opts.jobId ?? `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

  const result: { image?: string; images?: string[]; mask?: string; tempStorageKeys: string[] } = {
    tempStorageKeys,
  };

  if (rawRefs.length > 0) {
    const resolvedUrls: string[] = [];
    for (let i = 0; i < rawRefs.length; i++) {
      const ref = rawRefs[i];
      if (/^https?:\/\//i.test(ref) && isSafePublicUrl(ref)) {
        resolvedUrls.push(ref);
        continue;
      }

      try {
        const resolvedBuf = await resolveSingleImageBuffer({
          userId: opts.userId,
          ref,
          storage: opts.storage,
          fetchBytes: opts.fetchBytes,
          db: opts.db,
        });
        if (resolvedBuf) {
          const tempKey = `temp/jobs/${jobId}/image-${i}.png`;
          try {
            await opts.storage.put({
              key: tempKey,
              body: resolvedBuf.bytes,
              contentType: "image/png",
            });
            const url = await getStoragePublicOrSignedUrl(opts.storage, tempKey);
            if (url) {
              tempStorageKeys.push(tempKey);
              resolvedUrls.push(url);
              continue;
            }
          } catch {}
          const b64 = Buffer.from(resolvedBuf.bytes).toString("base64");
          resolvedUrls.push(`data:image/png;base64,${b64}`);
        }
      } catch (err) {
        console.warn(`[resolveInputImages] Failed to resolve reference "${ref}":`, err);
      }
    }

    if (resolvedUrls.length > 0) {
      result.image = resolvedUrls[0];
      result.images = resolvedUrls;
    }
  }

  // Resolve Mask jika ada (untuk Inpainting)
  const rawMask =
    typeof opts.params.mask === "string" && opts.params.mask.trim()
      ? opts.params.mask.trim()
      : typeof opts.params.mask_url === "string" && opts.params.mask_url.trim()
        ? opts.params.mask_url.trim()
        : typeof opts.params.maskDataUrl === "string" && opts.params.maskDataUrl.trim()
          ? opts.params.maskDataUrl.trim()
          : undefined;

  if (rawMask) {
    if (/^https?:\/\//i.test(rawMask) && isSafePublicUrl(rawMask)) {
      result.mask = rawMask;
    } else {
      try {
        const resolvedMaskBuf = await resolveSingleImageBuffer({
          userId: opts.userId,
          ref: rawMask,
          storage: opts.storage,
          fetchBytes: opts.fetchBytes,
          db: opts.db,
        });
        if (resolvedMaskBuf) {
          const tempKey = `temp/jobs/${jobId}/mask.png`;
          try {
            await opts.storage.put({
              key: tempKey,
              body: resolvedMaskBuf.bytes,
              contentType: "image/png",
            });
            const url = await getStoragePublicOrSignedUrl(opts.storage, tempKey);
            if (url) {
              tempStorageKeys.push(tempKey);
              result.mask = url;
            }
          } catch {}
          if (!result.mask) {
            const b64 = Buffer.from(resolvedMaskBuf.bytes).toString("base64");
            result.mask = `data:image/png;base64,${b64}`;
          }
        }
      } catch (err) {
        console.warn(`[resolveInputImages] Failed to resolve mask reference:`, err);
      }
    }
  }

  return result;
}

export async function resolveSingleImageBuffer(opts: {
  userId: string;
  ref: string;
  storage: ObjectStorage;
  fetchBytes: (url: string) => Promise<FetchedBytes>;
  db?: ResolveInputsDb;
}): Promise<ResolvedImageBuffer | null> {
  const { userId, ref, storage, fetchBytes, db = defaultResolveInputsDb } = opts;
  let imageBytes: Uint8Array | null = null;

  // 0. Referensi gambar template (template-image:<id>) — cabang pertama, tidak boleh jatuh ke regex ID lama
  const templateImageId = parseTemplateImageRef(ref);
  if (templateImageId !== null || ref.startsWith(TEMPLATE_IMAGE_REF_PREFIX)) {
    if (!templateImageId) {
      return null;
    }

    let templateImage: {
      storageKey: string;
      template: { isActive: boolean; isSpicy: boolean } | null;
    } | null = null;
    let user: { spicyModeEnabled: boolean } | null = null;
    try {
      [templateImage, user] = await Promise.all([
        db.templateImage.findUnique({
          where: { id: templateImageId },
          include: { template: { select: { isActive: true, isSpicy: true } } },
        }),
        db.user.findUnique({
          where: { id: userId },
          select: { spicyModeEnabled: true },
        }),
      ]);
    } catch {
      return null;
    }

    if (!templateImage?.template || !user) {
      return null;
    }
    if (!isTemplateRefAllowed(templateImage.template, user.spicyModeEnabled)) {
      return null;
    }

    try {
      const obj = await storage.get(templateImage.storageKey);
      if (obj?.body) {
        imageBytes = obj.body;
      }
    } catch {
      return null;
    }
  } else if (ref.startsWith("data:image/")) {
    // 1. Validasi & Sanitasi Base64 Data URL (Celah Keamanan 3)
    const commaIdx = ref.indexOf(",");
    if (commaIdx === -1) return null;
    const base64Data = ref.slice(commaIdx + 1).trim();
    // Batasi payload maksimal 20MB Base64 untuk mencegah memory exhaustion / DoS
    if (!base64Data || base64Data.length > 20 * 1024 * 1024) {
      return null;
    }
    try {
      const rawBuffer = Buffer.from(base64Data, "base64");
      // Normalisasi & verifikasi magic bytes gambar melalui sharp
      const pngBuffer = await sharp(rawBuffer).png().toBuffer();
      return { bytes: new Uint8Array(pngBuffer), contentType: "image/png" };
    } catch {
      return null;
    }
  } else {
    // 2. Ekstrak jika merupakan referensi ID (Upload atau Job Generate)
    const idMatch = ref.match(/(up_[a-f0-9]+|up-[a-f0-9-]+|c[a-z0-9]{24}|[a-z0-9_-]{10,40})/i);
    if (idMatch) {
      const assetId = idMatch[1];

      // 2a. Coba cari di objek Upload milik user
      const uploadKeys = [
        `uploads/customer/${userId}/${assetId}.webp`,
        `uploads/admin/${userId}/${assetId}.webp`,
      ];
      for (const key of uploadKeys) {
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
          const uploadRepo = db.upload ?? prisma.upload;
          const uploadRow = await uploadRepo.findFirst({
            where: { id: assetId, userId, deletedAt: null },
            select: { storageKey: true },
          });
          if (uploadRow?.storageKey) {
            const obj = await storage.get(uploadRow.storageKey);
            if (obj?.body) imageBytes = obj.body;
          }
        } catch {}
      }

      // 2b. Coba cari di objek Output Job milik user (IDOR Safe)
      if (!imageBytes) {
        const jobKey = `outputs/${userId}/${assetId}.webp`;
        try {
          const obj = await storage.get(jobKey);
          if (obj && obj.body) {
            imageBytes = obj.body;
          }
        } catch {}

        if (!imageBytes) {
          try {
            const jobAssetRepo = db.jobAsset ?? prisma.jobAsset;
            const jobRow = await jobAssetRepo.findFirst({
              where: {
                jobId: assetId,
                kind: "output",
                job: { userId }, // Wajib pemilik job
              },
              select: { storageKey: true },
            });
            if (jobRow?.storageKey) {
              const obj = await storage.get(jobRow.storageKey);
              if (obj?.body) imageBytes = obj.body;
            }
          } catch {}
        }
      }
    }

    // 3. Jika merupakan URL HTTP/HTTPS publik
    // Perbaikan Celah Keamanan 2 (SSRF): Verifikasi URL aman sebelum melakukan fetch
    if (!imageBytes && /^https?:\/\//i.test(ref)) {
      if (isSafePublicUrl(ref)) {
        try {
          const fetched = await fetchBytes(ref);
          if (fetched && fetched.body) {
            imageBytes = fetched.body;
          }
        } catch {}
      }
    }
  }

  if (!imageBytes || imageBytes.length === 0) {
    return null;
  }

  // Konversi ke PNG Buffer yang valid untuk AI Provider
  try {
    const pngBuffer = await sharp(Buffer.from(imageBytes)).png().toBuffer();
    return { bytes: new Uint8Array(pngBuffer), contentType: "image/png" };
  } catch {
    return { bytes: imageBytes, contentType: "image/png" };
  }
}

export async function resolveSingleImageToDataUrl(opts: {
  userId: string;
  ref: string;
  storage: ObjectStorage;
  fetchBytes: (url: string) => Promise<FetchedBytes>;
  db?: ResolveInputsDb;
}): Promise<string | null> {
  const resolved = await resolveSingleImageBuffer(opts);
  if (!resolved) return null;
  const b64 = Buffer.from(resolved.bytes).toString("base64");
  return `data:${resolved.contentType};base64,${b64}`;
}
