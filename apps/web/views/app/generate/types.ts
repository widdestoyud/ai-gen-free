export type Model = {
  mode: string;
  modelId: string;
  displayName: string;
  providerId: string;
  costPoints: number;
  isSpicy?: boolean;
};

export type DefaultGenerationModelsConfig = {
  normalT2iModelId: string;
  normalI2iModelId: string;
  spicyT2iModelId: string;
  spicyI2iModelId: string;
  normalVideoModelId: string;
  spicyVideoModelId: string;
};

