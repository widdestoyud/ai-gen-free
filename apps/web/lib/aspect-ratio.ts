export type AspectRatioId = "2:3" | "3:2" | "1:1" | "9:16" | "16:9";

export interface AspectRatioOption {
  readonly value: AspectRatioId;
  readonly label: string;
  readonly preview: "tall" | "wide" | "square";
  readonly dimension: string;
  readonly tierSize: "1k" | "2k";
  readonly width: number;
  readonly height: number;
}

export const ASPECT_RATIO_CONFIGS: Record<AspectRatioId, AspectRatioOption> = {
  "2:3": {
    value: "2:3",
    label: "2:3 Tall",
    preview: "tall",
    dimension: "1024x1536",
    tierSize: "1k",
    width: 1024,
    height: 1536,
  },
  "3:2": {
    value: "3:2",
    label: "3:2 Wide",
    preview: "wide",
    dimension: "1536x1024",
    tierSize: "1k",
    width: 1536,
    height: 1024,
  },
  "1:1": {
    value: "1:1",
    label: "1:1 Square",
    preview: "square",
    dimension: "1024x1024",
    tierSize: "1k",
    width: 1024,
    height: 1024,
  },
  "9:16": {
    value: "9:16",
    label: "9:16 Vertical",
    preview: "tall",
    dimension: "768x1024",
    tierSize: "1k",
    width: 768,
    height: 1024,
  },
  "16:9": {
    value: "16:9",
    label: "16:9 Widescreen",
    preview: "wide",
    dimension: "1024x768",
    tierSize: "1k",
    width: 1024,
    height: 768,
  },
};

export const STUDIO_ASPECTS = [
  ASPECT_RATIO_CONFIGS["2:3"],
  ASPECT_RATIO_CONFIGS["3:2"],
  ASPECT_RATIO_CONFIGS["1:1"],
  ASPECT_RATIO_CONFIGS["9:16"],
  ASPECT_RATIO_CONFIGS["16:9"],
] as const;

export const ASPECT_RATIO_SIZE_MAP: Record<string, string> = {
  "2:3": "1024x1536",
  "3:2": "1536x1024",
  "1:1": "1024x1024",
  "9:16": "768x1024",
  "16:9": "1024x768",
};

export function getAspectMetadata(ratio: string): AspectRatioOption {
  return ASPECT_RATIO_CONFIGS[ratio as AspectRatioId] ?? ASPECT_RATIO_CONFIGS["3:2"];
}

export function transformAspectRatioToSize(ratio: string): string {
  return ASPECT_RATIO_SIZE_MAP[ratio] ?? "1024x1024";
}
