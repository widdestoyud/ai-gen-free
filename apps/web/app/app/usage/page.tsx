import { Title } from "@mantine/core";
import { EmptyState } from "@/components/empty-state";

export default function AppUsagePage() {
  return (
    <>
      <Title order={2} mb="md">
        Usage
      </Title>
      <EmptyState>Riwayat pemakaian akan tampil di sini.</EmptyState>
    </>
  );
}
