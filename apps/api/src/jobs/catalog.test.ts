import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import { humanDisplayName, pickEnabledModel, type CatalogRow } from "./catalog.js";

const siray: CatalogRow = {
  mode: "t2i",
  modelId: "black-forest-labs/flux-1.1-pro-t2i",
  displayName: "Flux 1.1 Pro",
  providerId: "siray",
  costPoints: 10,
  isSpicy: false,
};
const dummy: CatalogRow = {
  mode: "t2i",
  modelId: "dummy-t2i",
  displayName: "Dummy",
  providerId: "dummy",
  costPoints: 10,
  isSpicy: false,
};

const sirayEdit: CatalogRow = {
  mode: "i2i",
  modelId: "openai/gpt-image-2-edit",
  displayName: "GPT Image 2 Edit",
  providerId: "siray",
  costPoints: 10,
  isSpicy: false,
};

const sirayVideo: CatalogRow = {
  mode: "i2v",
  modelId: "bytedance/seedance-2.5-i2v",
  displayName: "Seedance 2.5 I2V",
  providerId: "siray",
  costPoints: 10,
  isSpicy: false,
};

test("omitted modelId uses the only enabled model", () => {
  assert.equal(pickEnabledModel([siray], "t2i", undefined).providerId, "siray");
  assert.equal(pickEnabledModel([sirayEdit], "i2i", undefined).providerId, "siray");
  assert.equal(pickEnabledModel([sirayVideo], "i2v", undefined).providerId, "siray");
});

test("explicit modelId must match an enabled row", () => {
  assert.equal(pickEnabledModel([siray, dummy], "t2i", "dummy-t2i").providerId, "dummy");
  assert.equal(pickEnabledModel([sirayEdit], "i2i", "openai/gpt-image-2-edit").modelId, "openai/gpt-image-2-edit");
  assert.equal(pickEnabledModel([sirayVideo], "i2v", "bytedance/seedance-2.5-i2v").modelId, "bytedance/seedance-2.5-i2v");
  assert.throws(
    () => pickEnabledModel([siray], "t2i", "dummy-t2i"),
    (err: unknown) => err instanceof AppError && err.code === ErrorCodes.VALIDATION_ERROR,
  );
});

test("0 or >1 enabled models require modelId", () => {
  assert.throws(
    () => pickEnabledModel([], "t2i", undefined),
    (err: unknown) => err instanceof AppError && err.code === ErrorCodes.VALIDATION_ERROR,
  );
  assert.throws(
    () => pickEnabledModel([siray, dummy], "t2i", undefined),
    (err: unknown) => err instanceof AppError && err.code === ErrorCodes.VALIDATION_ERROR,
  );
});

test("unsupported mode is VALIDATION_ERROR", () => {
  assert.throws(
    () => pickEnabledModel([siray], "invalid_mode", undefined),
    (err: unknown) => err instanceof AppError && err.code === ErrorCodes.VALIDATION_ERROR,
  );
});

test("displayName fallback from map", () => {
  assert.equal(humanDisplayName("black-forest-labs/flux-1.1-pro-t2i", ""), "Flux 1.1 Pro");
  assert.equal(humanDisplayName("openai/gpt-image-2-edit", ""), "GPT Image 2 Edit");
  assert.equal(humanDisplayName("bytedance/seedream-5.0-pro-t2i-spicy", ""), "Seedream 5.0 Pro Spicy");
  assert.equal(humanDisplayName("bytedance/seedance-2.5-i2v", ""), "Seedance 2.5 I2V");
  assert.equal(humanDisplayName("bytedance/seedance-2.0-i2v-spicy", ""), "Seedance 2.0 I2V Spicy");
  assert.equal(humanDisplayName("bytedance/seedance-2.5-i2v-spicy", ""), "Seedance 2.5 I2V Spicy");
  assert.equal(humanDisplayName("alibaba/wan-2.7-i2v-uncensored", ""), "Wan 2.7 I2V Uncensored");
  assert.equal(humanDisplayName("dummy-t2i", "Dummy"), "Dummy");
});
