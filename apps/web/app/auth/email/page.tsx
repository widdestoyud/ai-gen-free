import type { Metadata } from "next";
import { EmailValidationView } from "@/views/auth";

export const metadata: Metadata = {
  title: "Validasi Email",
  description: "Verifikasi alamat email akun satulabs.id Anda.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AuthEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token.trim() : "";
  return <EmailValidationView token={token} />;
}
