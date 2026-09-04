"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type FormEvent } from "react";
import type { JobRow, Model } from "./page";

export function GenerateClient(props: { available: number; held: number; models: Model[]; jobs: JobRow[] }) {
  const router = useRouter();
  const t2i = props.models.find((m) => m.mode === "t2i");
  const [prompt, setPrompt] = useState("");
  const [fail, setFail] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = props.jobs.find((j) => j.status === "queued" || j.status === "running");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          mode: "t2i",
          prompt,
          params: fail ? { fail: true } : {},
        }),
      });
      const body = (await res.json()) as {
        job_id?: string;
        error?: { message: string };
        retry_after_seconds?: number;
      };
      if (!res.ok) {
        const wait = body.retry_after_seconds
          ? ` Coba lagi dalam ${Math.ceil(body.retry_after_seconds / 3600)} jam.`
          : "";
        setError((body.error?.message ?? "Gagal submit") + wait);
        return;
      }
      if (body.job_id) router.push(`/jobs/${body.job_id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p>
        Saldo <strong>{props.available}</strong> poin
        {props.held > 0 ? ` (terkunci ${props.held})` : ""}
      </p>
      <p style={{ color: "#c5c9d1" }}>
        Biaya t2i dummy: <strong>{t2i?.costPoints ?? "—"}</strong> poin. Poin dipotong hanya jika berhasil.
        Gambar dummy tersimpan 14 hari.
      </p>
      {active ? (
        <p>
          Ada generate yang masih jalan.{" "}
          <a href={`/jobs/${active.id}`} style={{ color: "#8ab4ff" }}>
            Buka job
          </a>
        </p>
      ) : null}
      <form onSubmit={(e) => void onSubmit(e)}>
        <label style={{ display: "block", margin: "16px 0 8px" }}>
          Prompt
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={4}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: 8,
              borderRadius: 8,
              border: "1px solid #2a2f3a",
              background: "#0f1115",
              color: "#e8eaed",
              boxSizing: "border-box",
            }}
          />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
          Simulasikan gagal (poin dikembalikan, tanpa jeda)
        </label>
        {error ? <p style={{ color: "#ff8a80" }}>{error}</p> : null}
        <button type="submit" disabled={busy || !t2i} style={btn}>
          Generate
        </button>
      </form>
    </div>
  );
}

const btn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: 0,
  background: "#3d7dff",
  color: "white",
  cursor: "pointer",
};
