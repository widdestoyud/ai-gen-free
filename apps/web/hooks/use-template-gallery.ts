"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { CustomerTemplate } from "@/lib/template-apply";

export type TemplateSort = "default" | "trending" | "newest";

export type TemplateListPage = {
  items: CustomerTemplate[];
  page: number;
  limit: number;
  hasMore: boolean;
};

export type TemplateCategoriesResponse = {
  categories: string[];
};

const PAGE_LIMIT = 12;
const SEARCH_DEBOUNCE_MS = 300;
const OBSERVER_ROOT_MARGIN = "400px";

/**
 * Controller hook untuk galeri template studio:
 * mengelola filter (search debounce 300ms, kategori, sort, mode 18+),
 * infinite scroll via TanStack Query + IntersectionObserver, dan daftar kategori aktif.
 */
export function useTemplateGallery(opts: { spicyEnabled: boolean }) {
  const { spicyEnabled } = opts;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<TemplateSort>("default");
  const [adultRequested, setAdultRequested] = useState(false);

  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
  const [scrollRootEl, setScrollRootEl] = useState<HTMLDivElement | null>(null);

  const adultOn = spicyEnabled ? adultRequested : false;

  useEffect(() => {
    if (!spicyEnabled && adultRequested) {
      setAdultRequested(false);
    }
  }, [spicyEnabled, adultRequested]);

  useEffect(() => {
    const trimmed = query.trim();
    const timer = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const setAdultOn = useCallback(
    (next: boolean) => {
      if (!next) {
        setAdultRequested(false);
        setCategory(null);
        return;
      }
      if (!spicyEnabled) {
        setAdultRequested(false);
        return;
      }
      setAdultRequested(true);
      setCategory(null);
    },
    [spicyEnabled],
  );

  const filters = useMemo(
    () => ({
      q: debouncedQuery.length > 0 ? debouncedQuery : null,
      category,
      sort,
      spicy: adultOn,
    }),
    [debouncedQuery, category, sort, adultOn],
  );

  const categoriesQuery = useQuery<string[]>({
    queryKey: queryKeys.templateCategories(adultOn),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("spicy", adultOn ? "1" : "0");
      const res = await requestJson<TemplateCategoriesResponse>(
        `/api/templates/categories?${params.toString()}`,
      );
      if (!res.ok) {
        throw new Error(res.message);
      }
      return Array.isArray(res.data?.categories) ? res.data.categories : [];
    },
    staleTime: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const templatesQuery = useInfiniteQuery<TemplateListPage>({
    queryKey: queryKeys.templates(filters),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === "number" ? pageParam : 1;
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_LIMIT));
      if (filters.q) params.set("q", filters.q);
      if (filters.category) params.set("category", filters.category);
      if (filters.sort !== "default") params.set("sort", filters.sort);
      params.set("spicy", filters.spicy ? "1" : "0");

      const res = await requestJson<TemplateListPage>(
        `/api/templates?${params.toString()}`,
      );
      if (!res.ok) {
        throw new Error(res.message);
      }
      return res.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const items = useMemo(() => {
    const pages = templatesQuery.data?.pages ?? [];
    const seen = new Set<string>();
    const merged: CustomerTemplate[] = [];
    for (const page of pages) {
      for (const item of page.items ?? []) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          merged.push(item);
        }
      }
    }
    return merged;
  }, [templatesQuery.data?.pages]);

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    setSentinelEl(node);
  }, []);

  const scrollRootRef = useCallback((node: HTMLDivElement | null) => {
    setScrollRootEl(node);
  }, []);

  const {
    hasNextPage,
    isFetchingNextPage,
    isError,
    fetchNextPage,
  } = templatesQuery;

  useEffect(() => {
    if (!sentinelEl) return;
    if (!hasNextPage || isFetchingNextPage || isError) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      {
        root: scrollRootEl,
        rootMargin: OBSERVER_ROOT_MARGIN,
      },
    );

    observer.observe(sentinelEl);
    return () => observer.disconnect();
  }, [sentinelEl, scrollRootEl, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const categories = categoriesQuery.data ?? [];
  const errorMessage =
    templatesQuery.error instanceof Error ? templatesQuery.error.message : null;

  return {
    filters,
    query,
    setQuery,
    category,
    setCategory,
    sort,
    setSort,
    adultOn,
    setAdultOn,
    items,
    categories,
    fetchNextPage: templatesQuery.fetchNextPage,
    hasNextPage: Boolean(templatesQuery.hasNextPage),
    isFetchingNextPage: templatesQuery.isFetchingNextPage,
    isLoading: templatesQuery.isLoading,
    isError: templatesQuery.isError,
    errorMessage,
    refetch: templatesQuery.refetch,
    sentinelRef,
    scrollRootRef,
  };
}
