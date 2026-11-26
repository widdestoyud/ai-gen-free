export type TemplateAssetValue = {
  key: string;
  url: string;
  width: number;
  height: number;
};

export type AdminTemplateImage = TemplateAssetValue & {
  id: string;
  alias: string | null;
};

export type AdminTemplate = {
  id: string;
  title: string;
  prompt: string;
  category: string | null;
  modelId: string | null;
  aspectRatio: string;
  isSpicy: boolean;
  coverUrl: string;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  cover: TemplateAssetValue;
  images: AdminTemplateImage[];
};

export type AdminTemplatesListResponse = {
  items: AdminTemplate[];
  total: number;
  page: number;
  limit: number;
};

export type AdminTemplatesSearchParams = {
  page?: string;
  limit?: string;
  q?: string;
  category?: string;
  isSpicy?: string;
  isActive?: string;
  sortBy?: string;
  sortOrder?: string;
};

export type TemplateFormPayload = {
  title: string;
  prompt: string;
  category: string | null;
  modelId: string | null;
  aspectRatio: string;
  isSpicy: boolean;
  isActive: boolean;
  sortOrder: number;
  cover: {
    key: string;
    width: number;
    height: number;
  };
  images: Array<{
    key: string;
    alias: string | null;
    width: number;
    height: number;
  }>;
};

export const TEMPLATE_MODEL_IDS = [
  "t2i-standard",
  "t2i-spicy",
  "i2i-standard",
  "i2i-spicy",
] as const;

export const TEMPLATE_ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "3:4",
  "4:3",
] as const;

export const MAX_TEMPLATE_REFERENCES = 4;
