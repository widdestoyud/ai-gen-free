export const OUTPUT_ASPECTS = [
  { id: "1:1", w: 1, h: 1 },
  { id: "2:3", w: 2, h: 3 },
  { id: "3:2", w: 3, h: 2 },
  { id: "9:16", w: 9, h: 16 },
  { id: "16:9", w: 16, h: 9 },
] as const;

export type OutputAspect = (typeof OUTPUT_ASPECTS)[number];

export type CropBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Pilih rasio daftar yang paling dekat dengan width/height asli. */
export function nearestOutputAspect(width: number, height: number): OutputAspect {
  const ratio = width / Math.max(height, 1);
  let best: OutputAspect = OUTPUT_ASPECTS[0];
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const candidate of OUTPUT_ASPECTS) {
    const diff = Math.abs(Math.log(ratio / (candidate.w / candidate.h)));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return best;
}

/** Crop tengah ke rasio target, tanpa memperbesar kanvas. */
export function centerCropBox(width: number, height: number, aspect: OutputAspect): CropBox {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const target = aspect.w / aspect.h;
  const current = w / h;
  if (Math.abs(current - target) < 0.004) {
    return { left: 0, top: 0, width: w, height: h };
  }
  if (current > target) {
    const cropW = Math.max(1, Math.round(h * target));
    return { left: Math.max(0, Math.round((w - cropW) / 2)), top: 0, width: Math.min(cropW, w), height: h };
  }
  const cropH = Math.max(1, Math.round(w / target));
  return { left: 0, top: Math.max(0, Math.round((h - cropH) / 2)), width: w, height: Math.min(cropH, h) };
}
