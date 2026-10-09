/**
 * Aspect Ratio & Dimension Converter Matrix
 *
 * Single Source of Truth untuk konversi aspek rasio dan resolusi dimensi
 * ke berbagai model AI upstream (Fal.ai, Siray, OpenAI, Bytedance, Alibaba, dll.).
 */

export type CanonicalAspectRatio =
  | "1:1"
  | "9:16"
  | "16:9"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:3"
  | "4:5"
  | "5:4";

export interface AspectRatioDimension {
  readonly width: number;
  readonly height: number;
  readonly dimension: string;
  readonly preview: "tall" | "wide" | "square";
  readonly label: string;
}

export type FalImageSizePreset =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9";

export interface FalDimensionObject {
  width: number;
  height: number;
}

export type FalImageSize = FalImageSizePreset | FalDimensionObject;

export interface ModelPayloadFormat {
  readonly modelFamily:
    | "fal-standard"
    | "fal-upscaler"
    | "siray-standard"
    | "siray-seedream"
    | "siray-gpt"
    | "siray-qwen"
    | "siray-wan"
    | "siray-seedance"
    | "generic";
  readonly payloadFields: Record<string, unknown>;
}

/**
 * Metadata standar kanonik sistem untuk setiap aspek rasio.
 */
export const CANONICAL_ASPECT_RATIOS: Record<CanonicalAspectRatio, AspectRatioDimension> = {
  "1:1": {
    width: 1024,
    height: 1024,
    dimension: "1024x1024",
    preview: "square",
    label: "1:1 Square",
  },
  "9:16": {
    width: 576,
    height: 1024,
    dimension: "576x1024",
    preview: "tall",
    label: "9:16 Vertical",
  },
  "16:9": {
    width: 1024,
    height: 576,
    dimension: "1024x576",
    preview: "wide",
    label: "16:9 Widescreen",
  },
  "2:3": {
    width: 1024,
    height: 1536,
    dimension: "1024x1536",
    preview: "tall",
    label: "2:3 Tall",
  },
  "3:2": {
    width: 1536,
    height: 1024,
    dimension: "1536x1024",
    preview: "wide",
    label: "3:2 Wide",
  },
  "3:4": {
    width: 768,
    height: 1024,
    dimension: "768x1024",
    preview: "tall",
    label: "3:4 Portrait",
  },
  "4:3": {
    width: 1024,
    height: 768,
    dimension: "1024x768",
    preview: "wide",
    label: "4:3 Landscape",
  },
  "4:5": {
    width: 819,
    height: 1024,
    dimension: "819x1024",
    preview: "tall",
    label: "4:5 Portrait",
  },
  "5:4": {
    width: 1024,
    height: 819,
    dimension: "1024x819",
    preview: "wide",
    label: "5:4 Landscape",
  },
};

/**
 * Format payload Seedream (Siray) berdasarkan aspek rasio.
 */
export const SEEDREAM_ASPECT_PAYLOAD_MAP: Record<CanonicalAspectRatio, string> = {
  "1:1": "1024x1024",
  "9:16": "800x1424",
  "16:9": "1424x800",
  "2:3": "832x1248",
  "3:2": "1248x832",
  "3:4": "864x1152",
  "4:3": "1152x864",
  "4:5": "864x1152",
  "5:4": "1152x864",
};

/**
 * Format payload GPT Image 2 (OpenAI) berdasarkan aspek rasio.
 */
export const GPT_IMAGE_ASPECT_PAYLOAD_MAP: Record<CanonicalAspectRatio, string> = {
  "1:1": "1024x1024",
  "9:16": "1024x1536",
  "16:9": "1536x1024",
  "2:3": "1024x1536",
  "3:2": "1536x1024",
  "3:4": "1024x1536",
  "4:3": "1536x1024",
  "4:5": "1024x1536",
  "5:4": "1536x1024",
};

/**
 * Format payload Fal.ai (Krea 2, Flux, SDXL, dll.) berdasarkan aspek rasio.
 */
export const FAL_ASPECT_PAYLOAD_MAP: Record<CanonicalAspectRatio, FalImageSize> = {
  "1:1": "square_hd",
  "9:16": "portrait_16_9",
  "16:9": "landscape_16_9",
  "2:3": { width: 832, height: 1216 },
  "3:2": { width: 1216, height: 832 },
  "3:4": "portrait_4_3",
  "4:3": "landscape_4_3",
  "4:5": "portrait_4_3",
  "5:4": "landscape_4_3",
};

/**
 * Format payload Wan Video (Alibaba Wan 2.1 / 2.7) - Subset aspek rasio yang didukung.
 */
export const WAN_VIDEO_ASPECT_MAP: Record<CanonicalAspectRatio, string> = {
  "1:1": "1:1",
  "9:16": "9:16",
  "16:9": "16:9",
  "2:3": "9:16",
  "3:2": "16:9",
  "3:4": "3:4",
  "4:3": "4:3",
  "4:5": "3:4",
  "5:4": "4:3",
};

/**
 * Format payload Video Ringan Fal.ai (Fast SVD / Fast AnimateDiff) - Resolusi terkecil & durasi <= 1s.
 */
export const FAL_FAST_VIDEO_RESOLUTION_MAP: Record<CanonicalAspectRatio, { width: number; height: number; dimension: string }> = {
  "1:1": { width: 512, height: 512, dimension: "512x512" },
  "9:16": { width: 384, height: 640, dimension: "384x640" },
  "16:9": { width: 640, height: 384, dimension: "640x384" },
  "2:3": { width: 384, height: 576, dimension: "384x576" },
  "3:2": { width: 576, height: 384, dimension: "576x384" },
  "3:4": { width: 384, height: 512, dimension: "384x512" },
  "4:3": { width: 512, height: 384, dimension: "512x384" },
  "4:5": { width: 384, height: 512, dimension: "384x512" },
  "5:4": { width: 512, height: 384, dimension: "512x384" },
};

/**
 * Mendeteksi famili model dari modelId string.
 */
export function detectModelFamily(modelId: string): ModelPayloadFormat["modelFamily"] | "fal-fast-video" | "fal-flux-schnell" {
  const lower = modelId.toLowerCase();

  if (lower.includes("seedvr") || lower.includes("upscale")) {
    return "fal-upscaler";
  }
  if (lower.includes("fast-svd") || lower.includes("fast-animatediff") || lower.includes("svd") || lower.includes("animatediff")) {
    return "fal-fast-video";
  }
  if (lower.includes("schnell")) {
    return "fal-flux-schnell";
  }
  if (lower.startsWith("fal-ai/") || lower.startsWith("fal/")) {
    return "fal-standard";
  }
  if (lower.includes("seedream") && lower.includes("t2i")) {
    return "siray-seedream";
  }
  if (lower.includes("gpt-image")) {
    return "siray-gpt";
  }
  if ((lower.includes("qwen") || lower.includes("alibaba")) && !lower.includes("wan") && !lower.includes("i2v") && !lower.includes("t2v")) {
    return "siray-qwen";
  }
  if (lower.includes("wan")) {
    return "siray-wan";
  }
  if (lower.includes("seedance")) {
    return "siray-seedance";
  }
  if (lower.includes("siray") || lower.includes("flux")) {
    return "siray-standard";
  }
  return "generic";
}

/**
 * Normalisasi string rasio ke CanonicalAspectRatio.
 */
export function normalizeCanonicalAspectRatio(ratio?: string | null): CanonicalAspectRatio {
  if (!ratio) return "1:1";
  const trimmed = ratio.trim() as CanonicalAspectRatio;
  if (trimmed in CANONICAL_ASPECT_RATIOS) {
    return trimmed;
  }
  return "1:1";
}

/**
 * Konverter Universal: Menghasilkan potongan payload spesifik dimensi/rasio untuk model tujuan.
 *
 * @param modelId Identifier model upstream (misal: "fal-ai/krea-2/turbo/lora", "bytedance/seedream-3.0-t2i-spicy")
 * @param aspectRatio Aspek rasio input (misal: "9:16", "16:9", "1:1")
 * @param explicitSize Parameter ukuran opsional yang dilewatkan pengguna
 * @returns Record field payload yang siap disisipkan ke dalam request API model tersebut
 */
export function convertAspectRatioPayload(
  modelId: string,
  aspectRatio?: string | null,
  explicitSize?: unknown,
): Record<string, unknown> {
  const family = detectModelFamily(modelId);
  const canonical = normalizeCanonicalAspectRatio(aspectRatio);

  switch (family) {
    case "fal-fast-video": {
      const res = FAL_FAST_VIDEO_RESOLUTION_MAP[canonical] ?? FAL_FAST_VIDEO_RESOLUTION_MAP["1:1"];
      const isSvd = modelId.toLowerCase().includes("svd");
      return {
        duration: 1,
        num_frames: isSvd ? 14 : 16,
        fps: isSvd ? 14 : 16,
        aspect_ratio: canonical,
        resolution: res.dimension,
        width: res.width,
        height: res.height,
      };
    }

    case "fal-flux-schnell": {
      const imageSize = FAL_ASPECT_PAYLOAD_MAP[canonical] ?? "square_hd";
      return {
        aspect_ratio: canonical,
        image_size: imageSize,
        num_inference_steps: 4,
      };
    }

    case "fal-standard": {
      const imageSize = FAL_ASPECT_PAYLOAD_MAP[canonical] ?? "square_hd";
      return {
        aspect_ratio: canonical,
        image_size: imageSize,
      };
    }

    case "fal-upscaler": {
      return {
        upscale_mode: "factor",
        target_resolution: "4K",
      };
    }

    case "siray-seedream": {
      return {
        size: SEEDREAM_ASPECT_PAYLOAD_MAP[canonical] ?? "1024x1024",
      };
    }

    case "siray-gpt": {
      return {
        size: GPT_IMAGE_ASPECT_PAYLOAD_MAP[canonical] ?? "1024x1024",
      };
    }

    case "siray-qwen": {
      return {
        size: "1k",
        aspect_ratio: canonical,
        prompt_expansion_enable: false,
      };
    }

    case "siray-wan": {
      return {
        aspect_ratio: WAN_VIDEO_ASPECT_MAP[canonical] ?? "16:9",
      };
    }

    case "siray-seedance": {
      return {
        duration: 6,
        resolution: "480",
        aspect_ratio: canonical,
      };
    }

    case "siray-standard":
    case "generic":
    default: {
      return {
        aspect_ratio: canonical,
      };
    }
  }
}
