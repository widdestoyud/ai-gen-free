"use client";

import { useEffect, useState } from "react";
import { Button, Group, Paper, Skeleton, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { CreditHistory } from "./components/credit-history";
import type { LedgerRow } from "./types";

export type BillingData = {
  wallet: { available: number; held: number };
  entries: LedgerRow[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

export function BillingPageView(props: { data?: BillingData }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const [page, setPage] = useState(props.data?.page ?? urlPage);

  useEffect(() => {
    setPage(urlPage);
  }, [urlPage]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(searchParams.toString());
      if (newPage <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(newPage));
      }
      const qs = params.toString();
      const nextUrl = qs ? `${pathname}?${qs}` : pathname;
      window.history.replaceState(null, "", nextUrl);
    }
  };

  // 1. Separate wallet query so page change NEVER refetches wallet balance
  const { data: walletData, isLoading: isWalletLoading } = useQuery<{ available: number; held: number }>({
    queryKey: queryKeys.wallet(),
    queryFn: async () => {
      const res = await requestJson<{ available: number; held: number }>("/api/wallet");
      return res.ok && res.data ? res.data : { available: 0, held: 0 };
    },
    initialData: props.data?.wallet,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // 2. Separate ledger query with keepPreviousData so page transitions only update table without layout shift
  const { data: ledgerData, isFetching: isLedgerFetching } = useQuery<{
    entries: LedgerRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: queryKeys.billingLedger({ page }),
    queryFn: async () => {
      const res = await requestJson<{ entries: LedgerRow[]; total?: number; page?: number; limit?: number; totalPages?: number }>(
        `/api/wallet/ledger?page=${page}&limit=10`
      );
      return {
        entries: res.ok && Array.isArray(res.data?.entries) ? res.data.entries : [],
        total: res.ok && typeof res.data?.total === "number" ? res.data.total : 0,
        page: res.ok && typeof res.data?.page === "number" ? res.data.page : page,
        limit: 10,
        totalPages: res.ok && typeof res.data?.totalPages === "number" ? res.data.totalPages : 1,
      };
    },
    initialData: props.data
      ? {
          entries: props.data.entries,
          total: props.data.total ?? props.data.entries.length,
          page: props.data.page ?? page,
          limit: 10,
          totalPages: props.data.totalPages ?? 1,
        }
      : undefined,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const wallet = walletData ?? { available: 0, held: 0 };
  const entries = ledgerData?.entries ?? props.data?.entries ?? [];
  const total = ledgerData?.total ?? props.data?.total ?? entries.length;
  const totalPages = ledgerData?.totalPages ?? props.data?.totalPages ?? 1;

  return (
    <div>
      <Title order={2} mb="md">Billing</Title>

      {isWalletLoading && !props.data ? (
        <Paper p="md" withBorder mb="lg">
          <Group justify="space-between" align="center">
            <div>
              <Skeleton height={14} width={120} mb={8} radius="xs" />
              <Skeleton height={28} width={160} radius="xs" />
            </div>
            <Skeleton height={36} width={120} radius="md" />
          </Group>
        </Paper>
      ) : (
        <Paper p="md" withBorder mb="lg">
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="dimmed">
                Saldo Sparks Saat Ini
              </Text>
              <Text size="xl" fw={700}>
                {wallet.available} Sparks
              </Text>
              {wallet.held > 0 ? (
                <Text size="xs" c="yellow.6">
                  ({wallet.held} Sparks sedang terkunci pada proses generate)
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
      )}

      <CreditHistory
        entries={entries}
        currentBalance={wallet.available}
        pagination={{
          total,
          page,
          limit: 10,
          totalPages,
        }}
        onPageChange={handlePageChange}
        isLoading={isLedgerFetching}
      />
    </div>
  );
}
