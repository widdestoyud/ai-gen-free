import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { appendSirayTrace, runWithSirayJobLog } from "./siray-file-log.js";

test("writes Siray poll failure into jobId and task_id files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "siray-log-"));
  process.env.SIRAY_LOG_DIR = dir;
  await runWithSirayJobLog("job-abc", async () => {
    await appendSirayTrace({
      at: "2026-09-11T12:00:00.000Z",
      phase: "poll",
      method: "GET",
      path: "/v1/images/generations/async/task-1",
      httpStatus: 200,
      response: {
        code: "success",
        data: {
          task_id: "task-1",
          status: "FAILURE",
          fail_code: "ServerOverloaded",
          fail_reason: "upstream busy",
        },
      },
    });
  });
  const byJob = await readFile(join(dir, "job-abc.txt"), "utf8");
  const byTask = await readFile(join(dir, "task-1.txt"), "utf8");
  assert.match(byJob, /jobId=job-abc/);
  assert.match(byJob, /sirayStatus=FAILURE/);
  assert.match(byJob, /sirayFailReason=upstream busy/);
  assert.match(byTask, /sirayTaskId=task-1/);
});
