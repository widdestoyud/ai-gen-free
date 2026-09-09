import { auth, signOut } from "@/auth";
import { apiBase } from "@/lib/server-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (session?.sid) {
    await fetch(`${apiBase()}/api/user/logout`, {
      method: "POST",
      headers: { cookie: `sid=${session.sid}` },
    });
  }
  await signOut({ redirect: false });
  return Response.json({ ok: true, message: "Berhasil keluar." });
}
