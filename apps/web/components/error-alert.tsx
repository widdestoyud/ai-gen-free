"use client";

import { Alert, Text } from "@mantine/core";

export function ErrorAlert({
  message,
  code,
  transactionId,
}: {
  message?: string | null;
  code?: string | null;
  transactionId?: string | null;
}) {
  if (!message) return null;
  return (
    <Alert color="red" variant="light">
      <Text size="sm">{message}</Text>
      {code || transactionId ? (
        <Text size="xs" c="dimmed" mt={4}>
          {code ? `Kode: ${code}` : ""}
          {code && transactionId ? " · " : ""}
          {transactionId ? `ID: ${transactionId}` : ""}
        </Text>
      ) : null}
    </Alert>
  );
}
