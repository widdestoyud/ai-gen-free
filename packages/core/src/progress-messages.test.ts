import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PROGRESS_MESSAGES,
  getProgressMessage,
  getProgressStageKey,
  type ProgressStageKey,
} from "./progress-messages.js";

test("all 5 progress stages have exactly 20 distinct sentences", () => {
  const stages: ProgressStageKey[] = ["10", "30", "50", "80", "100"];

  for (const stage of stages) {
    const list = PROGRESS_MESSAGES[stage];
    assert.ok(list, `Stage ${stage} must exist`);
    assert.equal(list.length, 20, `Stage ${stage} must contain exactly 20 sentences`);

    // Check all sentences are non-empty strings
    for (const msg of list) {
      assert.ok(typeof msg === "string" && msg.trim().length > 10, `Message in stage ${stage} must be meaningful`);
    }

    // Check all 20 sentences in this stage are unique
    const unique = new Set(list);
    assert.equal(unique.size, 20, `Stage ${stage} must not have duplicate sentences`);
  }
});

test("total unique sentences across all stages is 100", () => {
  const allMessages = Object.values(PROGRESS_MESSAGES).flat();
  assert.equal(allMessages.length, 100);
  const uniqueAll = new Set(allMessages);
  assert.equal(uniqueAll.size, 100, "All 100 messages must be globally unique");
});

test("getProgressStageKey resolves correct stages", () => {
  assert.equal(getProgressStageKey(0), "10");
  assert.equal(getProgressStageKey(10), "10");
  assert.equal(getProgressStageKey(29), "10");
  assert.equal(getProgressStageKey(30), "30");
  assert.equal(getProgressStageKey(49), "30");
  assert.equal(getProgressStageKey(50), "50");
  assert.equal(getProgressStageKey(79), "50");
  assert.equal(getProgressStageKey(80), "80");
  assert.equal(getProgressStageKey(99), "80");
  assert.equal(getProgressStageKey(100), "100");
  assert.equal(getProgressStageKey(105), "100");
});

test("getProgressMessage rotates smoothly with index", () => {
  const msg0 = getProgressMessage(35, 0);
  const msg1 = getProgressMessage(35, 1);
  const msg20 = getProgressMessage(35, 20); // Should wrap to index 0

  assert.notEqual(msg0, msg1);
  assert.equal(msg0, msg20);
});
