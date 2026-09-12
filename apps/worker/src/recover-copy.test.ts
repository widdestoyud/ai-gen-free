import assert from "node:assert/strict";
import { test } from "node:test";
import { recoverCopyPendingJobs } from "./recover-copy.js";

test("recover skips jobs already waiting/active", async () => {
  const added: string[] = [];
  const queue = {
    async getJob(id: string) {
      if (id === "waiting-1") return { getState: async () => "waiting", remove: async () => {} };
      if (id === "done-1") return { getState: async () => "completed", remove: async () => {} };
      return undefined;
    },
    async add(_name: string, data: { jobId: string }) {
      added.push(data.jobId);
    },
  };
  const n = await recoverCopyPendingJobs({
    store: {
      async listCopyPendingJobIds() {
        return ["waiting-1", "done-1", "fresh-1"];
      },
    },
    queue: queue as never,
    olderThanMs: 0,
  });
  assert.equal(n, 2);
  assert.deepEqual(added, ["done-1", "fresh-1"]);
});
