import sharp from "sharp";
import { centerCropBox, nearestOutputAspect } from "./aspect-ratio.js";
import type { FetchedBytes } from "./fetch-output.js";

const WEBP_QUALITY = 80;
const MAX_LONG_SIDE = 2048;

export type OptimizeOutputOptions = {
  isUpscale?: boolean;
  maxLongSide?: number;
  quality?: number;
};

export type OptimizedOutput = FetchedBytes & {
  aspectRatio: string;
  width: number;
  height: number;
};

export async function optimizeOutputImage(
  input: FetchedBytes,
  options?: OptimizeOutputOptions,
): Promise<OptimizedOutput> {
  if (!isRasterImage(input)) {
    return {
      ...input,
      aspectRatio: "n/a",
      width: 0,
      height: 0,
    };
  }

  const base = sharp(input.body, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 1 || height < 1) {
    throw new Error("output image missing dimensions");
  }

  const isUpscale = Boolean(options?.isUpscale);

  if (isUpscale) {
    // For upscale jobs:
    // 1. Preserve original aspect ratio & full resolution (no center crop)
    // 2. Allow up to 8192px max (do not downscale 4K/8K)
    // 3. High quality WebP (quality: 94, effort: 6) to avoid compression artifacts on fine details
    const maxDim = options?.maxLongSide ?? 8192;
    const longSide = Math.max(width, height);
    const scale = longSide > maxDim ? maxDim / longSide : 1;
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));
    const quality = options?.quality ?? 94;

    let pipeline = base;
    if (scale < 1) {
      pipeline = pipeline.resize(outW, outH, { fit: "inside" });
    }

    const body = await pipeline
      .webp({ quality, effort: 6 })
      .toBuffer();

    return {
      body: new Uint8Array(body),
      contentType: "image/webp",
      aspectRatio: `${outW}:${outH}`,
      width: outW,
      height: outH,
    };
  }

  const aspect = nearestOutputAspect(width, height);
  const crop = centerCropBox(width, height, aspect);
  const longSide = Math.max(crop.width, crop.height);
  const maxDim = options?.maxLongSide ?? MAX_LONG_SIDE;
  const scale = longSide > maxDim ? maxDim / longSide : 1;
  const outW = Math.max(1, Math.round(crop.width * scale));
  const outH = Math.max(1, Math.round(crop.height * scale));
  const quality = options?.quality ?? WEBP_QUALITY;

  const body = await base
    .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
    .resize(outW, outH, { fit: "fill" })
    .webp({ quality, effort: 4 })
    .toBuffer();

  return {
    body: new Uint8Array(body),
    contentType: "image/webp",
    aspectRatio: aspect.id,
    width: outW,
    height: outH,
  };
}

function isRasterImage(input: FetchedBytes): boolean {
  const type = input.contentType.toLowerCase();
  if (type.startsWith("image/") && !type.includes("svg")) return true;
  const b = input.body;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  return false;
}
