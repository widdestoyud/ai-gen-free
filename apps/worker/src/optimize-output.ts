import sharp from "sharp";
import { centerCropBox, nearestOutputAspect } from "./aspect-ratio.js";
import type { FetchedBytes } from "./fetch-output.js";

const WEBP_QUALITY = 80;
const MAX_LONG_SIDE = 2048;

export type OptimizedOutput = FetchedBytes & {
  aspectRatio: string;
  width: number;
  height: number;
};

export async function optimizeOutputImage(input: FetchedBytes): Promise<OptimizedOutput> {
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

  const aspect = nearestOutputAspect(width, height);
  const crop = centerCropBox(width, height, aspect);
  const longSide = Math.max(crop.width, crop.height);
  const scale = longSide > MAX_LONG_SIDE ? MAX_LONG_SIDE / longSide : 1;
  const outW = Math.max(1, Math.round(crop.width * scale));
  const outH = Math.max(1, Math.round(crop.height * scale));

  const body = await base
    .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
    .resize(outW, outH, { fit: "fill" })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
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
