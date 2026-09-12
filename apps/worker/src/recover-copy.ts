import type { Queue } from "bullmq";

export const RECOVER_EVERY_MS = 30_000;

export type RecoverStore = {
  listCopyPendingJobIds(olderThan: Date): Promise<string[]>;
};

/** Job running + task_id Siray + belum ada aset → enqueue ulang tanpa submit provider baru. */
export async function recoverCopyPendingJobs(opts: {
  store: RecoverStore;
  queue: Queue;
  olderThanMs?: number;
}): Promise<number> {
  const olderThan = new Date(Date.now() - (opts.olderThanMs ?? 20_000));
  const ids = await opts.store.listCopyPendingJobIds(olderThan);
  let enqueued = 0;
  for (const jobId of ids) {
    try {
      const existing = await opts.queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state === "active" || state === "waiting" || state === "delayed" || state === "paused") {
          continue;
        }
        await existing.remove();
      }
      await opts.queue.add(
        "generate",
        { jobId },
        {
          jobId,
          attempts: 10,
          backoff: { type: "custom" },
        },
      );
      enqueued += 1;
      console.log(JSON.stringify({ event: "job.recover_enqueued", jobId }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ event: "job.recover_failed", jobId, message }));
    }
  }
  return enqueued;
}
