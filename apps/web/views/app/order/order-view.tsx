"use client";

import { useEffect, useState } from "react";
import { SimpleGrid, Skeleton, Stack, Title } from "@mantine/core";
import { usePathname, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useI18n } from "@/lib/i18n";
import { OrderClient } from "./components/order-client";
import type { Invoice, Package } from "./types";

export type OrderData = {
  packages: Package[];
  invoices: Invoice[];
  wallet?: { available: number; held: number };
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

export function OrderPageView(props: {
  data?: OrderData;
}) {
  const { t } = useI18n("order");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const [page, setPage] = useState(props.data?.page ?? urlPage);
  const queryClient = useQueryClient();

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

  // 1. Packages catalog query (never changes on page transition)
  const { data: packagesData, isLoading: isPackagesLoading } = useQuery<Package[]>({
    queryKey: queryKeys.orderPackages(),
    queryFn: async () => {
      const res = await requestJson<{ packages?: Package[] }>("/api/catalog/topup");
      return res.ok && Array.isArray(res.data?.packages) ? res.data.packages : [];
    },
    initialData: props.data?.packages,
    staleTime: 5_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // 2. Wallet balance query
  const { data: walletData } = useQuery<{ available: number; held: number }>({
    queryKey: queryKeys.wallet(),
    queryFn: async () => {
      const res = await requestJson<{ available: number; held: number }>("/api/wallet");
      return res.ok && res.data ? res.data : { available: 0, held: 0 };
    },
    initialData: props.data?.wallet,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // 3. Invoices query with keepPreviousData to prevent page layout shift
  const { data: invoicesData, isFetching: isInvoicesFetching } = useQuery<{
    invoices: Invoice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: queryKeys.orderInvoices({ page }),
    queryFn: async () => {
      const res = await requestJson<{ invoices?: Invoice[]; total?: number; page?: number; limit?: number; totalPages?: number }>(
        `/api/invoices?page=${page}&limit=10`
      );
      return {
        invoices: res.ok && Array.isArray(res.data?.invoices) ? res.data.invoices : [],
        total: res.ok && typeof res.data?.total === "number" ? res.data.total : 0,
        page: res.ok && typeof res.data?.page === "number" ? res.data.page : page,
        limit: 10,
        totalPages: res.ok && typeof res.data?.totalPages === "number" ? res.data.totalPages : 1,
      };
    },
    initialData: props.data
      ? {
          invoices: props.data.invoices,
          total: props.data.total ?? props.data.invoices.length,
          page: props.data.page ?? page,
          limit: 10,
          totalPages: props.data.totalPages ?? 1,
        }
      : undefined,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      try {
        eventSource = new EventSource("/api/invoices/events");

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed?.type === "invoice_updated") {
              void queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
              void queryClient.invalidateQueries({ queryKey: queryKeys.orderInvoices() });
              void queryClient.invalidateQueries({ queryKey: queryKeys.billingLedger() });
              void queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile() });
            }
          } catch {}
        };

        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch {}
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [queryClient]);

  const packages = packagesData ?? props.data?.packages ?? [];
  const invoices = invoicesData?.invoices ?? props.data?.invoices ?? [];
  const total = invoicesData?.total ?? props.data?.total ?? invoices.length;
  const totalPages = invoicesData?.totalPages ?? props.data?.totalPages ?? 1;

  return (
    <>
      <Title order={2} mb="md">
        {t("title")}
      </Title>

      {isPackagesLoading && !props.data ? (
        <Stack gap="xl">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={320} radius="md" />
            ))}
          </SimpleGrid>
          <Skeleton height={200} radius="md" />
        </Stack>
      ) : (
        <OrderClient
          packages={packages}
          invoices={invoices}
          wallet={walletData ?? props.data?.wallet}
          pagination={{
            total,
            page,
            limit: 10,
            totalPages,
          }}
          onPageChange={handlePageChange}
          isLoading={isInvoicesFetching}
        />
      )}
    </>
  );
}
