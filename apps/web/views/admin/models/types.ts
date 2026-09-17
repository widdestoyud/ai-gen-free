export type AdminModelItem = {
  id: string;
  mode: string;
  modelId: string;
  displayName: string;
  providerId: string;
  costPoints: number;
  enabled: boolean;
  isSpicy: boolean;
  createdAt: string;
};

export type DefaultGenerationModelsConfig = {
  normalT2iModelId: string;
  normalI2iModelId: string;
  spicyT2iModelId: string;
  spicyI2iModelId: string;
  normalVideoModelId: string;
  spicyVideoModelId: string;
};
