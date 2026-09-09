import { EmailValidationView } from "@/components/email-validation-view";

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
