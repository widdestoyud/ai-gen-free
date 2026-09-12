import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyJobFailure, formatFailureNote } from "./failure-source.js";

test("credentials error is source=storage with R2 token hint", () => {
  const err = new Error("Could not load credentials from any providers");
  err.name = "CredentialsProviderError";
  const classified = classifyJobFailure("W006", err);
  assert.equal(classified.source, "storage");
  assert.match(classified.message, /storage \(R2\)/i);
  assert.match(classified.message, /kredensial/i);
  assert.match(classified.hint, /R2 object storage/i);
  assert.match(classified.hint, /STORAGE_ACCESS_KEY/);
  const note = formatFailureNote(classified, "job1");
  assert.match(note, /source=storage/);
  assert.match(note, /errorCode=W006/);
});

test("Siray timeout is source=siray", () => {
  const classified = classifyJobFailure("W003");
  assert.equal(classified.source, "siray");
  assert.match(classified.message, /Siray/i);
});

test("policy is source=siray", () => {
  assert.equal(classifyJobFailure("W002").source, "siray");
});

test("unknown prisma-like error is source=app", () => {
  const classified = classifyJobFailure("DUMMY_FAILED", new Error("P2002 unique constraint"));
  assert.equal(classified.source, "app");
  assert.match(classified.message, /aplikasi/i);
});
