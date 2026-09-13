import { Text } from "@mantine/core";
import { PageShell } from "@/components/page-shell";
import { LandingAuth } from "./components/landing-auth";

export function LandingPageView() {
  return (
    <PageShell kicker="Generator gambar" title="ai-gen-free">
      <Text c="dimmed">Masuk atau daftar untuk mulai memakai layanan.</Text>
      <LandingAuth />
    </PageShell>
  );
}
