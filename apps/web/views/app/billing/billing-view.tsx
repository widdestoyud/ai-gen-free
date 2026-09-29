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
        <Button
          component={Link}
          href="/app/order"
          prefetch={false}
          variant="gradient"
          gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
        >
          + Isi Saldo Sparks
        </Button>
      </Group>

      <Paper p="md" withBorder mb="lg">
        <Group justify="space-between" align="center">
          <div>
            <Text size="xs" c="dimmed">
              Saldo Sparks Saat Ini
            </Text>
            <Text size="xl" fw={700}>
              {data.wallet.available} Sparks
            </Text>
            {data.wallet.held > 0 ? (
              <Text size="xs" c="yellow.6">
                ({data.wallet.held} Sparks sedang terkunci pada proses generate)
              </Text>
            ) : null}
          </div>
          <Button
            component={Link}
            href="/app/order"
            prefetch={false}
            variant="gradient"
            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
            size="sm"
          >
            Topup Sparks
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
