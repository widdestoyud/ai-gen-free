"use client";

import { MantineProvider } from "@mantine/core";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useEffect, useState, type ReactNode } from "react";
import { theme } from "@/lib/theme";

const WALLET_DISALLOWED_CACHE_KEYS = [
  "wallet",
  "billing",
  "coin",
  "ledger",
  "order-data",
  "invoices",
  "customer-profile",
  "session",
  "payment-methods",
];

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 60 * 24,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            retry: 1,
          },
        },
      }),
  );

  const [persister] = useState(() => {
    if (typeof window === "undefined") {
      return {
        persistClient: () => {},
        restoreClient: () => undefined,
        removeClient: () => {},
      };
    }
    return createSyncStoragePersister({
      storage: window.localStorage,
      key: "SATULABS_QUERY_CACHE_V1",
    });
  });

  // Purge any previously cached wallet/billing/ledger data from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("SATULABS_QUERY_CACHE_V1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.clientState?.queries) {
          parsed.clientState.queries = parsed.clientState.queries.filter((q: any) => {
            const keyStr = Array.isArray(q.queryKey) ? q.queryKey.join(" ").toLowerCase() : String(q.queryKey).toLowerCase();
            return !WALLET_DISALLOWED_CACHE_KEYS.some((forbidden) => keyStr.includes(forbidden));
          });
          window.localStorage.setItem("SATULABS_QUERY_CACHE_V1", JSON.stringify(parsed));
        }
      }
    } catch {}
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const keyStr = Array.isArray(query.queryKey)
              ? query.queryKey.join(" ").toLowerCase()
              : String(query.queryKey).toLowerCase();
            const isWalletSensitive = WALLET_DISALLOWED_CACHE_KEYS.some((forbidden) =>
              keyStr.includes(forbidden),
            );
            return !isWalletSensitive;
          },
        },
      }}
    >
      <MantineProvider theme={theme} defaultColorScheme="dark">
        {children}
      </MantineProvider>
    </PersistQueryClientProvider>
  );
}
