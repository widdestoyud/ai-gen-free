import { ResetPasswordView } from "@/views/auth";

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
