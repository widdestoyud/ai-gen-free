import { prisma } from "@ai-gen-free/db";
import { createObjectStorageFromEnv } from "@ai-gen-free/storage";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import crypto from "node:crypto";

type SirayTaskDetail = {
  code?: string;
  data?: {
    task_id: string;
    action?: string;
    status: string;
    fail_code?: string;
    fail_reason?: string;
    outputs?: string[];
    output?: string;
    video_url?: string;
    submit_time?: number;
    start_time?: number;
    finish_time?: number;
    progress?: string;
    model?: string;
  };
};

export async function reconcileSirayTask(opts: {
  taskId: string;
  adminEmail?: string;
  customPrompt?: string;
  isVideo?: boolean;
}) {
  const token = (process.env.SIRAY_API_TOKEN ?? "").trim();
  const apiBase = (process.env.SIRAY_API_BASE ?? "https://api.siray.ai").replace(/\/+$/, "");

  console.log(`[Reconcile] Memulai rekonsiliasi Siray Task ID: ${opts.taskId}...`);

  // 1. Fetch task details from Siray
  const isVideo = opts.isVideo ?? true;
  const path = isVideo
    ? `/v1/video/generations/${encodeURIComponent(opts.taskId)}`
    : `/v1/images/generations/async/${encodeURIComponent(opts.taskId)}`;

  const res = await fetch(`${apiBase}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Gagal fetch ke Siray API (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as SirayTaskDetail;
  const data = json.data;
  if (!data) {
    throw new Error(`Data task tidak ditemukan di Siray: ${JSON.stringify(json)}`);
  }

  console.log(`[Reconcile] Status Siray: ${data.status}, Model: ${data.model ?? "unknown"}`);

  // 2. Find target admin user
  let adminUser = opts.adminEmail
    ? await prisma.user.findUnique({ where: { email: opts.adminEmail } })
    : await prisma.user.findFirst({ where: { role: "admin" } });

  if (!adminUser) {
    adminUser = await prisma.user.findFirst();
  }
  if (!adminUser) {
    throw new Error("Tidak ada user/admin di database untuk dikaitkan dengan rekonsiliasi.");
  }

  const modelId = data.model ?? (isVideo ? "bytedance/seedance-2.5-i2v" : "openai/gpt-image-2-t2i");
  const mode = isVideo ? "t2v" : "t2i";
  const promptText = opts.customPrompt || "test (Rekonsiliasi Probe Terminal)";
  const outputs = data.outputs ?? (data.output ? [data.output] : data.video_url ? [data.video_url] : []);
  if (data.fail_reason && data.fail_reason.startsWith("http") && !outputs.includes(data.fail_reason)) {
    outputs.push(data.fail_reason);
  }

  const submitDate = data.submit_time ? new Date(data.submit_time * 1000) : new Date();
  const startDate = data.start_time ? new Date(data.start_time * 1000) : submitDate;
  const finishDate = data.finish_time ? new Date(data.finish_time * 1000) : new Date();
  const isSuccess = data.status.toUpperCase() === "SUCCESS";

  // 3. Create or Update Job record in DB
  const idempotencyKey = `reconcile:siray:${opts.taskId}`;
  let job = await prisma.job.findFirst({
    where: { OR: [{ idempotencyKey }, { providerJobId: `video:${opts.taskId}` }, { providerJobId: opts.taskId }] },
  });

  if (!job) {
    job = await prisma.job.create({
      data: {
        userId: adminUser.id,
        mode,
        status: isSuccess ? "succeeded" : "failed",
        cost: 0, // Audit rekonsiliasi pengetesan
        modelId,
        providerId: "siray",
        providerJobId: isVideo ? `video:${opts.taskId}` : opts.taskId,
        prompt: promptText,
        params: {
          aspectRatio: "3:2",
          resolution: "480p",
          duration: "6s",
          isReconciled: true,
          reconciledAt: new Date().toISOString(),
          reconciledReason: "Pengetesan Terminal / Koreksi Audit Anti-Fraud",
          providerTaskId: opts.taskId,
          upstreamOutputs: outputs,
        },
        errorCode: isSuccess ? null : data.fail_code || "W001",
        progressPct: isSuccess ? 100 : 0,
        startedAt: startDate,
        finishedAt: finishDate,
        createdAt: submitDate,
        alias: `[REKONSILIASI KOREKSI] Hasil Render Video Upstream (${opts.taskId.slice(0, 8)})`,
        idempotencyKey,
      },
    });
  } else {
    job = await prisma.job.update({
      where: { id: job.id },
      data: {
        userId: adminUser.id,
        status: isSuccess ? "succeeded" : "failed",
        alias: `[REKONSILIASI KOREKSI] Hasil Render Video Upstream (${opts.taskId.slice(0, 8)})`,
        prompt: promptText,
      },
    });
  }

  // 4. Download output and store in Object Storage if succeeded
  if (isSuccess && outputs.length > 0) {
    try {
      const storage = createObjectStorageFromEnv();
      const outputUrl = outputs[0]!;
      console.log(`[Reconcile] Mengunduh aset output dari ${outputUrl}...`);
      const fileRes = await fetch(outputUrl);
      if (fileRes.ok) {
        const arrayBuf = await fileRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        const contentType = isVideo ? "video/mp4" : "image/webp";
        const ext = isVideo ? "mp4" : "webp";
        const storageKey = `outputs/${adminUser.id}/${job.id}.${ext}`;
        const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

        await storage.put({
          key: storageKey,
          body: bytes,
          contentType,
        });

        await prisma.jobAsset.upsert({
          where: { jobId_kind: { jobId: job.id, kind: "output" } },
          update: {
            storageKey,
            contentType,
            bytes: bytes.byteLength,
            sha256,
            expiresAt,
          },
          create: {
            jobId: job.id,
            kind: "output",
            storageKey,
            contentType,
            bytes: bytes.byteLength,
            sha256,
            expiresAt,
          },
        });
        console.log(`[Reconcile] Sukses menyimpan aset ke storage internal: ${storageKey}`);
      }
    } catch (storageErr) {
      console.warn(`[Reconcile] Catatan: Penyimpanan asset lokal storage dilewati: ${storageErr}`);
    }
  }

  // 5. Create SystemLog & AuditLog for Anti-Fraud Compliance
  await prisma.systemLog.create({
    data: {
      timestamp: new Date(),
      level: "info",
      service: "reconciliation",
      event: "reconciliation.task_corrected",
      message: `[REKONSILIASI KOREKSI] Task ID ${opts.taskId} berhasil direkonsiliasi dan dicatat ke sistem internal (Job ID: ${job.id}, Akun: ${adminUser.email})`,
      jobId: job.id,
      userId: adminUser.id,
      context: {
        isReconciliationCorrection: true,
        reconciledTaskId: opts.taskId,
        provider: "siray",
        status: data.status,
        model: modelId,
        outputs,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      action: "reconciliation.provider_task_imported",
      target: job.id,
      ip: "127.0.0.1",
      meta: {
        taskId: opts.taskId,
        providerId: "siray",
        isCorrection: true,
        note: "Penandaan audit rekonsiliasi pengujian teknis internal",
      },
    },
  });

  // 6. Write reconciliation log note to file logs/siray
  const logDir = join(process.cwd(), "logs", "siray");
  await mkdir(logDir, { recursive: true });

  const logBanner = `
================================================================================
[CATATAN REKONSILIASI & KOREKSI AUDIT PLATFORM]
Waktu Rekonsiliasi : ${new Date().toISOString()}
Tipe               : Koreksi Hasil Rekonsiliasi Upstream Task (Anti-Fraud)
Provider           : Siray (api.siray.ai)
Task ID Siray      : ${opts.taskId}
Job ID Sistem      : ${job.id}
Akun Penanggung    : ${adminUser.email} (${adminUser.id})
Status Siray       : ${data.status} (${data.progress || "100%"})
Model AI           : ${modelId}
Waktu Submit       : ${submitDate.toISOString()}
Waktu Selesai      : ${finishDate.toISOString()}
Output URL Upstream: ${outputs.join(", ")}
Penanda Audit      : isReconciliationCorrection=true (Koreksi Audit Sah)
================================================================================
`;

  await appendFile(join(logDir, `${job.id}.txt`), logBanner, "utf8");
  await appendFile(join(logDir, `${opts.taskId}.txt`), logBanner, "utf8");

  console.log(`[Reconcile] Berhasil merekonsiliasi task ${opts.taskId} -> Job ID: ${job.id}`);
  return {
    jobId: job.id,
    taskId: opts.taskId,
    userEmail: adminUser.email,
    status: job.status,
    outputs,
  };
}

// CLI execution
if (process.argv[1]?.includes("reconcile-provider-task")) {
  const taskId = process.argv[2] || "75ac57f1-a506-4679-9840-95ad93603581";
  reconcileSirayTask({ taskId })
    .then((result) => {
      console.log("[Reconcile Selesai]:", JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Reconcile Error]:", err);
      process.exit(1);
    });
}
