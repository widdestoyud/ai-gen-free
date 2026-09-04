export type Capability = "t2i" | "i2i" | "t2v" | "i2v" | "inpaint" | "faceswap";

export type CanonicalGenerateInput = {
  mode: Capability;
  prompt: string;
  params: Record<string, unknown>;
  inputFiles: { bytes: Uint8Array; contentType: string }[];
};

export type ProviderHandle = {
  providerId: string;
  providerJobId: string;
};

export type ProviderStatus = {
  state: "queued" | "running" | "succeeded" | "failed";
  progress?: number;
  outputUrls?: string[];
  errorCode?: string;
};

export interface GenerationProvider {
  readonly id: string;
  readonly capabilities: Capability[];
  submit(input: CanonicalGenerateInput): Promise<ProviderHandle>;
  getStatus(handle: ProviderHandle): Promise<ProviderStatus>;
}
