import type {
  CanonicalGenerateInput,
  Capability,
  GenerationProvider,
  ProviderHandle,
  ProviderStatus,
} from "@ai-gen-free/core";

export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export const PNG_1X1_DATA_URL = `data:image/png;base64,${PNG_1X1.toString("base64")}`;

export class DummyProvider implements GenerationProvider {
  readonly id = "dummy";
  readonly capabilities: Capability[] = ["t2i"];

  async submit(input: CanonicalGenerateInput): Promise<ProviderHandle> {
    const fail = input.params.fail === true;
    return {
      providerId: this.id,
      providerJobId: fail ? `dummy-fail-${Date.now()}` : `dummy-ok-${Date.now()}`,
    };
  }

  async getStatus(handle: ProviderHandle): Promise<ProviderStatus> {
    if (handle.providerJobId.includes("fail")) {
      return { state: "failed", errorCode: "DUMMY_FAILED", progress: 100 };
    }
    return { state: "succeeded", progress: 100, outputUrls: [PNG_1X1_DATA_URL] };
  }
}
