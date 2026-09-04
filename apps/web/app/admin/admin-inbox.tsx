"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import type { InboxItem } from "./page";

export function AdminInbox({ items }: { items: InboxItem[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function loadProof(id: string) {
    setError("");
    const res = await fetch(`/api/admin/invoices/${id}/proof`, { credentials: "include" });
    const body = (await res.json()) as { url?: string; contentType?: string; error?: { message: string } };
    if (!res.ok) {
      setError(body.error?.message ?? "Tidak bisa membuka bukti");
      return;
    }
    setPreviewType(body.contentType ?? null);
    setPreview(`/api/admin/invoices/${id}/file`);
  }

  async function approve(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/invoices/${id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setError(body.error?.message ?? "Gagal menerima");
        return;
      }
      setPreview(null);
      setPreviewType(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/invoices/${id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason[id] ?? "" }),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setError(body.error?.message ?? "Gagal menolak");
        return;
      }
      setPreview(null);
      setPreviewType(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return <p>Tidak ada bukti menunggu kurasi.</p>;
  }

  return (
    <div>
      {error ? <p style={{ color: "#ff8a80" }}>{error}</p> : null}
      {preview ? (
        <div style={{ marginBottom: 16 }}>
          <p>
            <a href={preview} target="_blank" rel="noreferrer" style={{ color: "#8ab4ff" }}>
              Buka bukti di tab baru
            </a>
          </p>
          {previewType?.startsWith("image/") ? (
            <img src={preview} alt="Bukti transfer" style={{ maxWidth: "100%", borderRadius: 8 }} />
          ) : null}
        </div>
      ) : null}
      {items.map((item) => (
        <article
          key={item.invoiceId}
          style={{
            border: "1px solid #2a2f3a",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            background: "#171a21",
          }}
        >
          <strong>{item.uniqueCode}</strong> · {item.email}
          <p>
            Rp{item.amountIdr.toLocaleString("id-ID")} · {item.points} poin
          </p>
          <p style={{ color: "#c5c9d1", fontSize: 13 }}>
            {item.proofSubmittedAt
              ? new Date(item.proofSubmittedAt).toLocaleString("id-ID")
              : ""}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={busy} onClick={() => void loadProof(item.invoiceId)} style={btn}>
              Lihat bukti
            </button>
            <button type="button" disabled={busy} onClick={() => void approve(item.invoiceId)} style={btn}>
              Terima
            </button>
          </div>
          <label style={{ display: "block", marginTop: 8 }}>
            Alasan tolak
            <input
              value={reason[item.invoiceId] ?? ""}
              onChange={(e) => setReason((s) => ({ ...s, [item.invoiceId]: e.target.value }))}
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
          <button type="button" disabled={busy} onClick={() => void reject(item.invoiceId)} style={{ ...btn, background: "#5c2b2b", marginTop: 8 }}>
            Tolak
          </button>
        </article>
      ))}
    </div>
  );
}

const btn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: 0,
  background: "#3d7dff",
  color: "white",
  cursor: "pointer",
};
