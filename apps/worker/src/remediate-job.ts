import { createHash } from "node:crypto";
import { prisma } from "@ai-gen-free/db";
import { FalProvider } from "@ai-gen-free/providers-fal";
import { SirayProvider } from "@ai-gen-free/providers-siray";
import { createObjectStorageFromEnv } from "@ai-gen-free/storage";
import { captureJob } from "@ai-gen-free/wallet";
import { AssetKind, JobStatus } from "@prisma/client";
import { extensionFor, fetchOutputBytes } from "./fetch-output.js";
import { optimizeOutputImage } from "./optimize-output.js";

const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

async function remediateJob(jobId: string) {
  console.log(`[Remediate] Starting remediation for jobId: ${jobId}`);

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { assets: true },
  });

  if (!job) {
    console.error(`[Remediate] Job ${jobId} not found`);
    return false;
  }

  if (!job.providerJobId) {
    console.error(`[Remediate] Job ${jobId} has no providerJobId`);
    return false;
  }

  console.log(`[Remediate] Provider: ${job.providerId}, providerJobId: ${job.providerJobId}`);

  let outputUrls: string[] = [];

  if (job.providerId === "falai" || job.providerId === "fal") {
    const falKey = process.env.FALAI_API_KEY ?? process.env.FAL_KEY ?? process.env.FAL_API_KEY ?? "";
    const provider = new FalProvider({
      key: falKey,
      apiBase: process.env.FALAI_API_BASE ?? process.env.FAL_API_BASE ?? "https://queue.fal.run",
    });

    const status = await provider.getStatus({
      providerId: "falai",
      providerJobId: job.providerJobId,
    });

    console.log(`[Remediate] Fal status:`, status);
    if (status.state === "succeeded" && status.outputUrls && status.outputUrls.length > 0) {
      outputUrls = status.outputUrls;
    } else {
      console.error(`[Remediate] Fal job state is not succeeded: ${status.state}`);
      return false;
    }
  } else if (job.providerId === "siray") {
    const sirayToken = process.env.SIRAY_API_TOKEN ?? "";
    const provider = new SirayProvider({
      token: sirayToken,
      apiBase: process.env.SIRAY_API_BASE,
    });

    const status = await provider.getStatus({
      providerId: "siray",
      providerJobId: job.providerJobId,
    });

    console.log(`[Remediate] Siray status:`, status);
    if (status.state === "succeeded" && status.outputUrls && status.outputUrls.length > 0) {
      outputUrls = status.outputUrls;
    } else {
      console.error(`[Remediate] Siray job state is not succeeded: ${status.state}`);
      return false;
    }
  }

  if (outputUrls.length === 0) {
    console.error(`[Remediate] No output URLs found`);
    return false;
  }

  const url = outputUrls[0]!;
  console.log(`[Remediate] Downloading output from ${url}...`);

  const storage = createObjectStorageFromEnv();
  const fetched = await fetchOutputBytes(url);
  const isUpscale = job.modelId.toLowerCase().includes("upscale") || (job.mode === "i2i" && job.modelId.toLowerCase().includes("upscale"));
  let stored = fetched;
  try {
    stored = await optimizeOutputImage(fetched, { isUpscale });
  } catch (err) {
    console.warn(`[Remediate] Optimization skipped:`, err);
  }

  const ext = extensionFor(stored.contentType);
  const key = `outputs/${job.userId}/${job.id}.${ext}`;

  console.log(`[Remediate] Uploading to storage key: ${key} (${stored.body.byteLength} bytes)...`);
  await storage.put({ key, body: stored.body, contentType: stored.contentType });

  const sha256 = createHash("sha256").update(stored.body).digest("hex");
  const expiresAt = new Date(Date.now() + RETENTION_MS);

  // Check if asset already exists
  const existingAsset = await prisma.jobAsset.findFirst({
    where: { jobId: job.id, kind: AssetKind.output },
  });

  if (!existingAsset) {
    await prisma.jobAsset.create({
      data: {
        jobId: job.id,
        kind: AssetKind.output,
        storageKey: key,
        contentType: stored.contentType,
        bytes: stored.body.byteLength,
        sha256,
        expiresAt,
      },
    });
  }

  // Deduct/capture user points
  try {
    await captureJob({
      userId: job.userId,
      jobId: job.id,
      amount: Number(job.cost),
    });
  } catch (err) {
    console.warn(`[Remediate] captureJob notice:`, err);
  }

  // Update job record to succeeded
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: JobStatus.succeeded,
      errorCode: null,
      progressPct: 100,
      finishedAt: new Date(),
    },
  });

  console.log(`[Remediate] Successfully remediated job ${job.id}! Status is now succeeded.`);
  return true;
}

// Auto-run for specific jobId or find all failed jobs with providerJobId
const targetJobId = process.argv[2] || "cmunjg3lv0001pg0z94412d01";

remediateJob(targetJobId)
  .then((success) => {
    console.log(`[Remediate] Completed with result: ${success ? "SUCCESS" : "FAILED"}`);
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error(`[Remediate] Error:`, err);
    process.exit(1);
  });
