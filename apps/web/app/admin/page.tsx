import { cookies } from "next/headers";
import Link from "next/link";

async function adminMe() {
  const jar = await cookies();
  const token = jar.get("sid_admin")?.value;
  const base = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  const res = await fetch(`${base}/api/admin/me`, {
    cache: "no-store",
    headers: {
      cookie: token ? `sid_admin=${token}` : "",
      authorization:
        process.env.ADMIN_BASIC_USER && process.env.ADMIN_BASIC_PASSWORD
          ? `Basic ${Buffer.from(`${process.env.ADMIN_BASIC_USER}:${process.env.ADMIN_BASIC_PASSWORD}`).toString("base64")}`
          : "",
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as { user: { email: string } };
}

export default async function AdminHomePage() {
  const me = await adminMe();
  if (!me) {
    return (
      <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1.5rem" }}>
        <h1>Admin</h1>
        <p>Sesi admin belum ada.</p>
        <Link href="/admin/login" style={{ color: "#8ab4ff" }}>
          Masuk dengan OTP
        </Link>
      </main>
    );
  }
  return (
    <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1.5rem" }}>
      <h1>Admin</h1>
      <p>Masuk sebagai {me.user.email}. Panel invoice dan cooldown menyusul di M5.</p>
    </main>
  );
}
