"use client";

import { useEffect, useState } from "react";
import type { JobView } from "./page";

export function JobClient({ initial }: { initial: JobView }) {
  const [job, setJob] = useState(initial);

  useEffect(() => {
    if (job.status === "succeeded" || job.status === "failed" || job.status === "canceled") return;
    const timer = setInterval(() => {
      void (async () => {
        const res = await fetch(`/api/jobs/${job.id}`, { credentials: "include" });
        if (!res.ok) return;
        setJob((await res.json()) as JobView);
      })();
    }, 1500);
    return () => clearInterval(timer);
  }, [job.id, job.status]);

  const statusLabel =
    job.status === "queued"
      ? "Dalam antrean"
      : job.status === "running"
        ? "Sedang generate"
        : job.status === "succeeded"
          ? "Berhasil"
          : job.status === "failed"
            ? "Gagal"
            : job.status;

  return (
    <div>
      <p>
        Status: <strong>{statusLabel}</strong> · {job.progressPct}%
      </p>
      <p style={{ color: "#c5c9d1" }}>{job.prompt}</p>
      {job.status === "queued" || job.status === "running" ? (
        <p>Boleh refresh. Job tetap jalan di server.</p>
      ) : null}
      {job.status === "succeeded" && job.output ? (
        <div>
          <p>Poin terpakai: {job.cost}. Jeda generate berikutnya sampai cooldown selesai.</p>
          <p style={{ color: "#c5c9d1" }}>
            Tersedia sampai {new Date(job.output.availableUntil).toLocaleString("id-ID")} (14 hari).
          </p>
          <img src={job.output.url} alt="Hasil generate" style={{ maxWidth: 240, borderRadius: 8, background: "#fff" }} />
        </div>
      ) : null}
      {job.status === "failed" ? (
        <p style={{ color: "#ff8a80" }}>Gagal ({job.errorCode ?? "error"}). Poin dikembalikan, tidak ada jeda.</p>
      ) : null}
    </div>
  );
}
