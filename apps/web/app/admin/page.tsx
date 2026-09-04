import { cookies } from "next/headers";
import Link from "next/link";
import { AdminInbox } from "./admin-inbox";

function adminHeaders() {
  const basic =
    process.env.ADMIN_BASIC_USER && process.env.ADMIN_BASIC_PASSWORD
      ? `Basic ${Buffer.from(`${process.env.ADMIN_BASIC_USER}:${process.env.ADMIN_BASIC_PASSWORD}`).toString("base64")}`
      : "";
  return { basic };
}

async function adminMe() {
  const jar = await cookies();
  const token = jar.get("sid_admin")?.value;
  const base = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  const { basic } = adminHeaders();
  const res = await fetch(`${base}/api/admin/me`, {
    cache: "no-store",
    headers: {
      cookie: token ? `sid_admin=${token}` : "",
      authorization: basic,
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as { user: { email: string } };
}

async function notifications() {
  const jar = await cookies();
  const token = jar.get("sid_admin")?.value;
  const base = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  const { basic } = adminHeaders();
  const res = await fetch(`${base}/api/admin/notifications`, {
    cache: "no-store",
    headers: {
      cookie: token ? `sid_admin=${token}` : "",
      authorization: basic,
    },
  });
  if (!res.ok) return { pendingCount: 0, items: [] as InboxItem[] };
  return (await res.json()) as { pendingCount: number; items: InboxItem[] };
}

export type InboxItem = {
  invoiceId: string;
  uniqueCode: string;
  email: string;
  amountIdr: number;
  points: number;
  proofSubmittedAt: string | null;
  status: string;
};

export default async function AdminHomePage() {
  const me = await adminMe();
  if (!me) {
    return (
      <main style={{ maxWidth: 720, margin: "4rem auto", padding: "0 1.5rem" }}>
        <h1>Admin</h1>
        <p>Sesi admin belum ada.</p>
        <Link href="/admin/login" style={{ color: "#8ab4ff" }}>
          Masuk dengan OTP
        </Link>
      </main>
    );
  }
  const inbox = await notifications();
  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1.5rem" }}>
      <h1>Admin</h1>
      <p>Masuk sebagai {me.user.email}.</p>
      <p>
        Notifikasi kurasi: <strong>{inbox.pendingCount}</strong> bukti menunggu.
      </p>
      <p style={{ color: "#c5c9d1" }}>
        Hanya bukti yang diunggah di dashboard yang boleh dikurasi. Screenshot chat tidak mengkredit poin.
      </p>
      <AdminInbox items={inbox.items} />
    </main>
  );
}
