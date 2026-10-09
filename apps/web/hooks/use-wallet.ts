"use client";

import { useQuery } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type WalletData = {
  available: number;
  held: number;
  currency?: string;
};

export function useWallet(initialData?: WalletData) {
  const query = useQuery<WalletData>({
    queryKey: queryKeys.wallet(),
    queryFn: async () => {
      const res = await requestJson<WalletData>("/api/wallet");
      if (res.ok && res.data) {
        return {
          available: Number(res.data.available) || 0,
          held: Number(res.data.held) || 0,
          currency: res.data.currency || "points",
        };
      }
      return { available: 0, held: 0, currency: "points" };
    },
    initialData,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: "always",
    networkMode: "always",
  });

  return {
    available: query.data?.available ?? 0,
    held: query.data?.held ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    data: query.data,
  };
}
