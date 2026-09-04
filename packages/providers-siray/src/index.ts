import type {
  CanonicalGenerateInput,
  Capability,
  GenerationProvider,
  ProviderHandle,
  ProviderStatus,
} from "@ai-gen-free/core";

/** Wired in M4. M0–M3 must not call submit. */
export class SirayProvider implements GenerationProvider {
  readonly id = "siray";
  readonly capabilities: Capability[] = ["t2i", "i2i", "t2v", "i2v"];

  submit(_input: CanonicalGenerateInput): Promise<ProviderHandle> {
    return Promise.reject(new Error("Siray adapter is not enabled until M4"));
  }

  getStatus(_handle: ProviderHandle): Promise<ProviderStatus> {
    return Promise.reject(new Error("Siray adapter is not enabled until M4"));
  }
}
