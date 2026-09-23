import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@ai-gen-free/db";

interface DurationStat {
  jobId: string;
  mode: string;
  modelId: string;
  status: string;
  totalDurationSec: number;
  workerDurationSec: number;
  providerDurationSec?: number;
}

function calculateMetrics(numbers: number[]) {
  if (numbers.length === 0) return { count: 0, min: 0, max: 0, avg: 0, median: 0, p90: 0 };
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Number(avg.toFixed(1)),
    median: Number(median.toFixed(1)),
    p90: Number(p90.toFixed(1)),
  };
}

async function analyzeFileLogs(): Promise<Map<string, { submitTime: Date; successTime: Date; providerSec: number }>> {
  const providerDurations = new Map<string, { submitTime: Date; successTime: Date; providerSec: number }>();
  const logsDir = join(process.cwd(), "logs", "siray");
  if (!existsSync(logsDir)) return providerDurations;

  const files = await readdir(logsDir);
  for (const file of files) {
    if (!file.endsWith(".txt")) continue;
    try {
      const content = await readFile(join(logsDir, file), "utf8");
      const blocks = content.split("-----").map((b) => b.trim()).filter(Boolean);

      let submitTime: Date | null = null;
      let successTime: Date | null = null;
      let resolvedJobId: string | null = null;

      for (const block of blocks) {
        const timeMatch = block.match(/time=([^\r\n]+)/);
        const phaseMatch = block.match(/phase=([^\r\n]+)/);
        const jobMatch = block.match(/jobId=([^\r\n]+)/);
        const statusMatch = block.match(/sirayStatus=SUCCESS/);

        if (jobMatch && !resolvedJobId) {
          resolvedJobId = jobMatch[1].trim();
        }

        if (timeMatch && phaseMatch) {
          const t = new Date(timeMatch[1].trim());
          const phase = phaseMatch[1].trim();

          if (phase === "submit" && !submitTime) {
            submitTime = t;
          }
          if (phase === "poll" && statusMatch) {
            successTime = t;
          }
        }
      }

      // Also check trailing line: SIRAY_SUCCESS or RESULT=succeeded
      const successLineMatch = content.match(/(\d{4}-\d{2}-\d{2}T[^\s]+)\s+(?:SIRAY_SUCCESS|RESULT=succeeded)/);
      if (successLineMatch && !successTime) {
        successTime = new Date(successLineMatch[1].trim());
      }

      if (submitTime && successTime && resolvedJobId) {
        const diffSec = (successTime.getTime() - submitTime.getTime()) / 1000;
        if (diffSec >= 0 && diffSec < 3600) {
          providerDurations.set(resolvedJobId, {
            submitTime,
            successTime,
            providerSec: Number(diffSec.toFixed(1)),
          });
        }
      }
    } catch {
      // skip
    }
  }

  return providerDurations;
}

async function main() {
  console.log("===============================================================");
  console.log("  ANALISIS WAKTU GENERATE (USER CLICK -> OUTPUT COMPLETED)");
  console.log("===============================================================\n");

  const providerLogTimes = await analyzeFileLogs();
  console.log(`Ditemukan ${providerLogTimes.size} pekerjaan dengan jejak submit -> success di berkas log.\n`);

  const jobs = await prisma.job.findMany({
    where: {
      status: "succeeded",
      finishedAt: { not: null },
    },
    select: {
      id: true,
      mode: true,
      modelId: true,
      status: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  console.log(`Total Job Succeeded di Database: ${jobs.length}`);

  const allStats: DurationStat[] = [];
  for (const j of jobs) {
    if (!j.finishedAt) continue;
    const totalSec = Number(((j.finishedAt.getTime() - j.createdAt.getTime()) / 1000).toFixed(1));
    const workerSec = j.startedAt
      ? Number(((j.finishedAt.getTime() - j.startedAt.getTime()) / 1000).toFixed(1))
      : totalSec;

    const fileLog = providerLogTimes.get(j.id);

    allStats.push({
      jobId: j.id,
      mode: j.mode,
      modelId: j.modelId,
      status: j.status,
      totalDurationSec: totalSec,
      workerDurationSec: workerSec,
      providerDurationSec: fileLog?.providerSec,
    });
  }

  // 1. Overall Metrics (Click -> Output)
  const allTotalSec = allStats.map((s) => s.totalDurationSec);
  const overallTotal = calculateMetrics(allTotalSec);
  const allWorkerSec = allStats.map((s) => s.workerDurationSec);
  const overallWorker = calculateMetrics(allWorkerSec);

  const providerSamples = allStats.map((s) => s.providerDurationSec).filter((n): n is number => typeof n === "number");
  const overallProvider = calculateMetrics(providerSamples);

  console.log("\n---------------------------------------------------------------");
  console.log("📊 1. WAKTU KESELURUHAN (SEMUA MODEL BERHASIL):");
  console.log("---------------------------------------------------------------");
  console.log(`▶ Total Waktu Pengguna (Klik Generate -> Output Siap):`);
  console.log(`  - Rata-rata (Average) : ${overallTotal.avg} detik`);
  console.log(`  - Nilai Tengah (Median): ${overallTotal.median} detik`);
  console.log(`  - P90 (90% selesai <) : ${overallTotal.p90} detik`);
  console.log(`  - Tercepat (Min)       : ${overallTotal.min} detik`);
  console.log(`  - Terlama (Max)        : ${overallTotal.max} detik`);

  if (overallProvider.count > 0) {
    console.log(`\n▶ Waktu Murni Pemrosesan Provider (Siray Submit -> SUCCESS):`);
    console.log(`  - Rata-rata (Average) : ${overallProvider.avg} detik`);
    console.log(`  - Nilai Tengah (Median): ${overallProvider.median} detik`);
    console.log(`  - P90 (90% selesai <) : ${overallProvider.p90} detik`);
    console.log(`  - Tercepat (Min)       : ${overallProvider.min} detik`);
    console.log(`  - Terlama (Max)        : ${overallProvider.max} detik`);
  }

  // 2. Breakdown by Mode (t2i vs i2i vs i2v)
  console.log("\n---------------------------------------------------------------");
  console.log("📊 2. RINCIAN WAKTU BERDASARKAN MODE (T2I vs I2I vs I2V):");
  console.log("---------------------------------------------------------------");

  const byMode = new Map<string, DurationStat[]>();
  for (const s of allStats) {
    const list = byMode.get(s.mode) || [];
    list.push(s);
    byMode.set(s.mode, list);
  }

  for (const [mode, list] of byMode.entries()) {
    const totalMetrics = calculateMetrics(list.map((s) => s.totalDurationSec));
    const providerList = list.map((s) => s.providerDurationSec).filter((n): n is number => typeof n === "number");
    const provMetrics = calculateMetrics(providerList);

    console.log(`\n🔹 MODE: [${mode.toUpperCase()}] (Total: ${list.length} job)`);
    console.log(`   Total (User Click -> Output):`);
    console.log(`     - Rata-rata : ${totalMetrics.avg}s | Median: ${totalMetrics.median}s | P90: ${totalMetrics.p90}s | Min: ${totalMetrics.min}s | Max: ${totalMetrics.max}s`);
    if (provMetrics.count > 0) {
      console.log(`   Murni Provider GPU (Siray):`);
      console.log(`     - Rata-rata : ${provMetrics.avg}s | Median: ${provMetrics.median}s | P90: ${provMetrics.p90}s`);
    }
  }

  // 3. Breakdown by Model
  console.log("\n---------------------------------------------------------------");
  console.log("📊 3. RINCIAN WAKTU PER MODEL SPESIFIK:");
  console.log("---------------------------------------------------------------");

  const byModel = new Map<string, DurationStat[]>();
  for (const s of allStats) {
    const list = byModel.get(s.modelId) || [];
    list.push(s);
    byModel.set(s.modelId, list);
  }

  for (const [modelId, list] of byModel.entries()) {
    const totalMetrics = calculateMetrics(list.map((s) => s.totalDurationSec));
    console.log(`• ${modelId.padEnd(42)} -> Avg: ${String(totalMetrics.avg).padStart(4)}s | Median: ${String(totalMetrics.median).padStart(4)}s | P90: ${String(totalMetrics.p90).padStart(4)}s | Max: ${String(totalMetrics.max).padStart(4)}s (n=${list.length})`);
  }

  console.log("\n===============================================================\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
