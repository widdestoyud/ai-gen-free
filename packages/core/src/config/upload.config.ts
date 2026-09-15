export type UploadRateLimitRule = {
  windowMs: number;
  maxRequests: number;
};

export const UploadConfig = {
  limits: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    maxFiles: 1,
  },
  allowedMimeTypes: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
  ] as const,
  allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"] as const,
  rateLimit: {
    customer: {
      windowMs: 60 * 1000, // 1 menit
      maxRequests: 10,
    } satisfies UploadRateLimitRule,
    admin: {
      windowMs: 60 * 1000, // 1 menit
      maxRequests: 30,
    } satisfies UploadRateLimitRule,
  },
  retention: {
    ttlSeconds: 24 * 60 * 60, // 24 jam (file upload sementara)
  },
  compression: {
    maxDimension: 2048, // Sisi terpanjang maksimal 2048px (rasio potrait / landscape tetap utuh)
    quality: 82, // Kualitas WebP
    format: "webp" as const,
  },
} as const;

export type AllowedUploadMimeType = (typeof UploadConfig.allowedMimeTypes)[number];
