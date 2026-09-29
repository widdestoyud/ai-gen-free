import type { Metadata } from "next";
import { ResetPasswordView } from "@/views/auth";

export const metadata: Metadata = {
  title: "Reset Kata Sandi",
  description: "Atur ulang kata sandi akun satulabs.id Anda.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AuthPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token.trim() : "";
  return <ResetPasswordView token={token} />;
}
