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
  images: CustomerTemplateImage[];
};

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
