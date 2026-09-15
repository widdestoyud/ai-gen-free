import { Button, Group, Paper, Text, Title } from "@mantine/core";
import Link from "next/link";
import { CreditHistory } from "./components/credit-history";
import type { LedgerRow } from "./types";

export function BillingPageView({
  data,
}: {
  data: {
    wallet: { available: number; held: number };
    entries: LedgerRow[];
  };
}) {
  return (
    <div>
      <Group justify="space-between" align="center" mb="md">
        <Title order={2}>Billing</Title>
        <Button component={Link} href="/app/order" variant="filled" color="blue">
          + Isi Saldo Poin
        </Button>
      </Group>

      <Paper p="md" withBorder mb="lg">
        <Group justify="space-between" align="center">
          <div>
            <Text size="xs" c="dimmed">
              Saldo Poin Saat Ini
            </Text>
            <Text size="xl" fw={700}>
              {data.wallet.available} Poin
            </Text>
            {data.wallet.held > 0 ? (
              <Text size="xs" c="yellow.6">
                ({data.wallet.held} poin sedang terkunci pada proses generate)
              </Text>
            ) : null}
          </div>
          <Button component={Link} href="/app/order" variant="light" color="blue" size="sm">
            Topup Poin
          </Button>
        </Group>
      </Paper>

      <CreditHistory
        entries={data.entries}
        currentBalance={data.wallet.available}
      />
    </div>
  );
}
