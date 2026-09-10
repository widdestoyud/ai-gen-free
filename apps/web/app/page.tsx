import { Text } from "@mantine/core";
import { redirect } from "next/navigation";
import { LandingAuth } from "@/components/landing-auth";
import { PageShell } from "@/components/page-shell";
import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/app/generate");
  }

  return (
    <PageShell kicker="Generator gambar" title="ai-gen-free">
      <Text c="dimmed">Masuk atau daftar untuk mulai memakai layanan.</Text>
      <LandingAuth />
    </PageShell>
  );
}
