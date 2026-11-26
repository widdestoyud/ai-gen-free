import type { StudioRef } from "../hooks/use-generate-studio";

export type CustomerTemplateImage = {
  id: string;
  url: string;
  alias: string | null;
  width: number;
  height: number;
};

export type CustomerTemplate = {
  id: string;
  title: string;
  prompt: string;
  category: string | null;
  modelId: string | null;
  aspectRatio: string;
  isSpicy: boolean;
  coverUrl: string;
  coverWidth?: number;
  coverHeight?: number;
  images: CustomerTemplateImage[];
};

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Menghitung CSS aspect-ratio string yang proporsional untuk cover template:
 * - Mengutamakan dimensi cover asli jika tersedia (e.g. 1080x1920 -> "9 / 16", 1200x800 -> "3 / 2")
 * - Fallback ke enum aspectRatio template (e.g. "9:16" -> "9 / 16", "1:1" -> "1 / 1")
 * - Default aman fallback "3 / 4"
 */
export function getTemplateAspectRatio(
  template: Pick<CustomerTemplate, "coverWidth" | "coverHeight" | "aspectRatio">,
): string {
  if (
    typeof template.coverWidth === "number" &&
    typeof template.coverHeight === "number" &&
    template.coverWidth > 0 &&
    template.coverHeight > 0
  ) {
    const divisor = gcd(template.coverWidth, template.coverHeight);
    const simplifiedW = Math.round(template.coverWidth / divisor);
    const simplifiedH = Math.round(template.coverHeight / divisor);
    return `${simplifiedW} / ${simplifiedH}`;
  }

  if (template.aspectRatio && typeof template.aspectRatio === "string") {
    const parts = template.aspectRatio.split(":").map((p) => p.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      const numW = parseFloat(parts[0]);
      const numH = parseFloat(parts[1]);
      if (!Number.isNaN(numW) && !Number.isNaN(numH) && numW > 0 && numH > 0) {
        return `${parts[0]} / ${parts[1]}`;
      }
    }
  }

  return "3 / 4";
}

export type ComposerSnapshot = {
  prompt: string;
  refIds: string[];
};

/**
 * Mengurutkan ulang tag fallback `@image1`, `@image2`, ... sambil mempertahankan `@alias` khusus.
 */
export function resequenceRefs(refs: StudioRef[]): StudioRef[] {
  let imageCounter = 1;
  return refs.map((ref) => {
    if (ref.alias && ref.alias.trim().length > 0) {
      return { ...ref, tag: `@${ref.alias.trim()}` };
    }
    const tag = `@image${imageCounter}`;
    imageCounter++;
    return { ...ref, tag };
  });
}

/**
 * Menentukan apakah penerapan template baru perlu konfirmasi timpa.
 * Hanya meminta konfirmasi jika composer tidak kosong dan sudah diubah manual sejak template terakhir diterapkan.
 */
export function needsOverwriteConfirm(
  current: ComposerSnapshot,
  lastApplied: ComposerSnapshot | null,
): boolean {
  if (current.prompt.trim().length === 0 && current.refIds.length === 0) {
    return false;
  }

  if (
    lastApplied !== null &&
    current.prompt === lastApplied.prompt &&
    current.refIds.length === lastApplied.refIds.length &&
    current.refIds.every((id, index) => id === lastApplied.refIds[index])
  ) {
    return false;
  }

  return true;
}

export type SpicyGateDecision = "allow" | "need_dob" | "need_consent";

/**
 * Menentukan langkah gerbang Spicy Mode saat pengguna meminta fitur 18+.
 */
export function resolveSpicyGate(enabled: boolean, hasDob: boolean): SpicyGateDecision {
  if (enabled) return "allow";
  if (!hasDob) return "need_dob";
  return "need_consent";
}

/**
 * Memilih modelId template jika masih tersedia di katalog terfilter, jika tidak fallback ke default aktif.
 */
export function pickTemplateModelId(
  requestedModelId: string | null | undefined,
  filteredModelIds: readonly string[],
  fallbackModelId: string,
): string {
  if (requestedModelId && filteredModelIds.includes(requestedModelId)) {
    return requestedModelId;
  }
  return fallbackModelId;
}

/**
 * Memetakan gambar referensi milik template menjadi item `StudioRef` siap-submit (`template-image:<id>`).
 */
export function templateToStudioRefs(t: CustomerTemplate): StudioRef[] {
  const refs: StudioRef[] = t.images.map((img) => ({
    id: `tpl-${img.id}`,
    url: img.url,
    kind: "template",
    submitUrl: `template-image:${img.id}`,
    alias: img.alias,
    width: img.width,
    height: img.height,
  }));

  return resequenceRefs(refs);
}
