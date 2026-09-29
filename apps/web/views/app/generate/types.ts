export type Model = {
  mode: string;
  modelId: string;
  costPoints: number;
  videoConfigPoints?: Record<string, number> | null;
  isSpicy?: boolean;
  displayName?: string;
  providerId?: string;
};

export type DefaultGenerationModelsConfig = {
  normalT2iModelId: string;
  normalI2iModelId: string;
  spicyT2iModelId: string;
  spicyI2iModelId: string;
  normalVideoModelId: string;
  spicyVideoModelId: string;
};

