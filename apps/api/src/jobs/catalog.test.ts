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
};
const dummy: CatalogRow = {
  mode: "t2i",
  modelId: "dummy-t2i",
  displayName: "Dummy",
  providerId: "dummy",
  costPoints: 10,
};

test("omitted modelId uses the only enabled model", () => {
  assert.equal(pickEnabledModel([siray], "t2i", undefined).providerId, "siray");
});

test("explicit modelId must match an enabled row", () => {
  assert.equal(pickEnabledModel([siray, dummy], "t2i", "dummy-t2i").providerId, "dummy");
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

test("non-t2i is VALIDATION_ERROR", () => {
  assert.throws(
    () => pickEnabledModel([siray], "t2v", undefined),
    (err: unknown) => err instanceof AppError && err.code === ErrorCodes.VALIDATION_ERROR,
  );
});

test("displayName fallback from map", () => {
  assert.equal(humanDisplayName("black-forest-labs/flux-1.1-pro-t2i", ""), "Flux 1.1 Pro");
  assert.equal(humanDisplayName("bytedance/seedream-5.0-pro-t2i-spicy", ""), "Seedream 5.0 Pro Spicy");
  assert.equal(humanDisplayName("dummy-t2i", "Dummy"), "Dummy");
});
