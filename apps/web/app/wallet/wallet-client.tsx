"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import type { Invoice, LedgerRow, Package } from "./page";

export function WalletClient(props: {
  available: number;
  held: number;
  packages: Package[];
  invoices: Invoice[];
  entries: LedgerRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function buy(packageId: string) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setError(body.error?.message ?? "Gagal membuat invoice");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function upload(invoiceId: string, file: File) {
    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/invoices/${invoiceId}/proof`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setError(body.error?.message ?? "Gagal unggah bukti");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p style={{ fontSize: "1.4rem" }}>
        Saldo <strong>{props.available}</strong> poin
        {props.held > 0 ? ` (terkunci ${props.held})` : ""}
      </p>
      <h2>Isi saldo</h2>
      <p style={{ color: "#c5c9d1" }}>
        Bayar QRIS sesuai invoice, lalu unggah bukti di sini. Poin masuk setelah admin menyetujui.
        Jangan kirim screenshot lewat WhatsApp atau Telegram.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0 24px" }}>
        {props.packages.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={busy}
            onClick={() => buy(p.id)}
            style={btn}
          >
            {p.label}
          </button>
        ))}
      </div>
      {error ? <p style={{ color: "#ff8a80" }}>{error}</p> : null}

      <h2>Invoice</h2>
      {props.invoices.length === 0 ? <p>Belum ada invoice.</p> : null}
      {props.invoices.map((inv) => (
        <article key={inv.id} style={card}>
          <strong>{inv.uniqueCode}</strong> · Rp{inv.amountIdr.toLocaleString("id-ID")} · {inv.points} poin
          <p>{inv.statusLabel}</p>
          {inv.instructions && inv.status === "unpaid" ? (
            <p style={{ color: "#c5c9d1", fontSize: 14 }}>{inv.instructions}</p>
          ) : null}
          {inv.reviewNote && inv.status === "rejected" ? (
            <p style={{ color: "#ff8a80" }}>Alasan: {inv.reviewNote}</p>
          ) : null}
          {(inv.status === "unpaid" || inv.status === "rejected") && (
            <label style={{ display: "block", marginTop: 8 }}>
              Unggah bukti
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(inv.id, file);
                }}
                style={{ display: "block", marginTop: 6 }}
              />
            </label>
          )}
        </article>
      ))}

      <h2>Riwayat</h2>
      {props.entries.length === 0 ? <p>Belum ada transaksi poin.</p> : null}
      <ul>
        {props.entries.map((e) => (
          <li key={e.id}>
            {e.label} · {e.amount} · {new Date(e.createdAt).toLocaleString("id-ID")}
          </li>
        ))}
      </ul>
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

const card: CSSProperties = {
  border: "1px solid #2a2f3a",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
  background: "#171a21",
};
