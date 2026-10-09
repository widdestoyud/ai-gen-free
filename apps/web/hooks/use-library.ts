"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { resolveUploadUrl } from "@/lib/format";
import { uploadFileWithProgress, type UploadItemProgress } from "@/lib/upload";
import { queryKeys } from "@/lib/query-keys";

export type LibraryTab = "all" | "generations" | "uploads";
export type LibraryViewMode = "grid" | "list";
export type LibrarySortBy = "date" | "name" | "size";
export type LibrarySortOrder = "newest" | "oldest";
export type LibraryShowOnly = "all" | "images" | "videos";

export type LibraryItem = {
  id: string;
  type: "generated" | "upload";
  kind: "image" | "video";
  alias?: string | null;
  prompt?: string | null;
  model_id?: string | null;
  cost?: number | null;
  status: string;
  url: string | null;
  mime_type: string;
  width?: number | null;
  height?: number | null;
  size_bytes?: number | null;
  created_at: string;
  expires_at?: string | null;
  params?: Record<string, unknown> | null;
  is_spicy?: boolean;
};

export type CustomerLibraryResponse = {
  total: number;
  limit: number;
  offset: number;
  items: LibraryItem[];
};

export function isUpscaledImage(item?: LibraryItem | null): boolean {
  if (!item) return false;
  if (item.type === "upload") return false;
  const model = (item.model_id || "").toLowerCase();
  if (model === "image-upscale" || model.includes("upscale")) return true;
  if (
    item.params &&
    (item.params.upscale_mode !== undefined ||
      item.params.upscale_factor !== undefined ||
      item.params.upscaleMode !== undefined ||
      item.params.upscaleFactor !== undefined)
  ) {
    return true;
  }
  return false;
}

export function useLibrary(props?: {
  initialItems?: LibraryItem[];
  initialTotal?: number;
}) {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<LibraryTab>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<LibraryViewMode>("grid");
  const [sortBy, setSortBy] = useState<LibrarySortBy>("date");
  const [sortOrder, setSortOrder] = useState<LibrarySortOrder>("newest");
  const [showOnly, setShowOnly] = useState<LibraryShowOnly>("all");
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [previewOpened, setPreviewOpened] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [inFlightUploads, setInFlightUploads] = useState<UploadItemProgress[]>([]);
  const [uploadPolicyAccepted, setUploadPolicyAccepted] = useState(false);
  const [uploadPolicyModalOpened, setUploadPolicyModalOpened] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      for (const item of inFlightUploads) {
        URL.revokeObjectURL(item.url);
      }
    };
  }, [inFlightUploads]);

  const userCheckedRef = useRef(false);

  const typeParam = showOnly !== "all" ? showOnly : tab;
  const sortParam = sortBy;
  const orderParam = sortOrder === "newest" ? "desc" : "asc";
  const qParam = search.trim();

  const queryKey = useMemo(
    () => queryKeys.library({ type: typeParam, sort: sortParam, order: orderParam, q: qParam }),
    [typeParam, sortParam, orderParam, qParam]
  );

  const {
    data,
    isLoading: isQueryLoading,
    isFetching,
    refetch,
  } = useQuery<CustomerLibraryResponse>({
    queryKey,
    queryFn: async () => {
      const query = new URLSearchParams();
      query.set("type", typeParam);
      query.set("sort", sortParam);
      query.set("order", orderParam);
      if (qParam) query.set("q", qParam);
      query.set("limit", "50");
      query.set("offset", "0");

      const res = await requestJson<CustomerLibraryResponse>(`/api/library?${query.toString()}`);
      if (!res.ok) {
        throw new Error(res.message || "Gagal memuat library");
      }
      return {
        ...res.data,
        items: (res.data.items || []).map((item) => ({
          ...item,
          url: resolveUploadUrl(item.url, item.id),
        })),
      };
    },
    initialData:
      props?.initialItems && props.initialItems.length > 0 && tab === "all" && sortBy === "date" && sortOrder === "newest" && showOnly === "all" && !qParam
        ? {
            total: props.initialTotal ?? props.initialItems.length,
            limit: 50,
            offset: 0,
            items: props.initialItems.map((item) => ({
              ...item,
              url: resolveUploadUrl(item.url, item.id),
            })),
          }
        : undefined,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 10, // 10 detik fresh cache
    gcTime: 1000 * 60 * 60 * 24, // 24 jam retention di storage
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const isLoading = isQueryLoading && items.length === 0;

  async function checkUserStatus() {
    if (userCheckedRef.current) return { accepted: uploadPolicyAccepted };
    const res = await requestJson<{
      user: {
        uploadPolicyAcceptedAt: string | null;
        hasUploads?: boolean;
      };
    }>("/api/me");
    if (!res.ok || !res.data?.user) return null;
    userCheckedRef.current = true;
    const accepted = Boolean(res.data.user.uploadPolicyAcceptedAt);
    setUploadPolicyAccepted(accepted);
    return {
      accepted,
      hasUploads: res.data.user.hasUploads,
    };
  }

  function handleTabChange(newTab: LibraryTab) {
    setTab(newTab);
  }

  function handleSearchChange(newSearch: string) {
    setSearch(newSearch);
  }

  function handleViewModeChange(newViewMode: LibraryViewMode) {
    setViewMode(newViewMode);
  }

  function handleSortByChange(newSortBy: LibrarySortBy) {
    setSortBy(newSortBy);
  }

  function handleSortOrderChange(newSortOrder: LibrarySortOrder) {
    setSortOrder(newSortOrder);
  }

  function handleShowOnlyChange(newShowOnly: LibraryShowOnly) {
    setShowOnly(newShowOnly);
  }

  const groupedItems = useMemo(() => {
    const today: LibraryItem[] = [];
    const yesterday: LibraryItem[] = [];
    const earlier: LibraryItem[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;

    for (const item of items) {
      const time = new Date(item.created_at).getTime();

      if (time >= todayStart) {
        today.push(item);
      } else if (time >= yesterdayStart) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    }

    const groups: Array<{ label: string; items: LibraryItem[] }> = [];
    if (today.length > 0) groups.push({ label: "Today", items: today });
    if (yesterday.length > 0) groups.push({ label: "Yesterday", items: yesterday });
    if (earlier.length > 0) groups.push({ label: "Earlier", items: earlier });

    if (groups.length === 0 && items.length > 0) {
      groups.push({ label: "Today", items });
    }

    return groups;
  }, [items]);

  function openPreview(item: LibraryItem) {
    setSelectedItem(item);
    setPreviewOpened(true);
  }

  function closePreview() {
    setPreviewOpened(false);
    setSelectedItem(null);
  }

  async function openFilePicker() {
    if (!userCheckedRef.current) {
      const status = await checkUserStatus();
      if (status && !status.accepted) {
        setUploadPolicyModalOpened(true);
        return;
      }
    } else if (!uploadPolicyAccepted) {
      setUploadPolicyModalOpened(true);
      return;
    }
    fileInputRef.current?.click();
  }

  async function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (!uploadPolicyAccepted) {
      setUploadPolicyModalOpened(true);
      return;
    }

    setIsUploading(true);

    const newUploads: UploadItemProgress[] = files.map((file) => {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      return {
        id: `upl-${crypto.randomUUID()}`,
        file,
        name: cleanName,
        alias: cleanName,
        url: URL.createObjectURL(file),
        progress: 0,
        uploading: true,
        error: null,
      };
    });

    setInFlightUploads((prev) => [...newUploads, ...prev]);

    const uploadPromises = newUploads.map((item) => {
      return new Promise<void>((resolve) => {
        uploadFileWithProgress(item.file, {
          onProgress: (pct) => {
            setInFlightUploads((prev) =>
              prev.map((u) => (u.id === item.id ? { ...u, progress: pct } : u))
            );
          },
          onSuccess: (res) => {
            setInFlightUploads((prev) =>
              prev.map((u) => (u.id === item.id ? { ...u, progress: 100, uploading: false } : u))
            );

            const newItem: LibraryItem = {
              id: res.id,
              type: "upload",
              kind: item.file.type.startsWith("video/") ? "video" : "image",
              alias: (res.alias || item.name).replace(/\.[^/.]+$/, ""),
              status: "completed",
              url: res.url,
              mime_type: item.file.type || "image/png",
              width: res.width ?? null,
              height: res.height ?? null,
              size_bytes: item.file.size,
              created_at: new Date().toISOString(),
            };

            queryClient.setQueriesData<CustomerLibraryResponse>(
              { queryKey: queryKeys.library() },
              (old) => {
                if (!old) return old;
                return {
                  ...old,
                  total: old.total + 1,
                  items: [newItem, ...old.items.filter((i) => i.id !== res.id)],
                };
              }
            );

            setTimeout(() => {
              URL.revokeObjectURL(item.url);
              setInFlightUploads((prev) => prev.filter((u) => u.id !== item.id));
            }, 500);
            resolve();
          },
          onError: (errMsg) => {
            setInFlightUploads((prev) =>
              prev.map((u) =>
                u.id === item.id ? { ...u, uploading: false, error: errMsg } : u
              )
            );
            resolve();
          },
        });
      });
    });

    await Promise.all(uploadPromises);
    setIsUploading(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.library() });
  }

  async function deleteUpload(id: string): Promise<boolean> {
    const res = await requestJson<{ ok?: boolean }>(`/api/customer-uploads/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (selectedItem?.id === id) {
        closePreview();
      }
      queryClient.setQueriesData<CustomerLibraryResponse>(
        { queryKey: queryKeys.library() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            total: Math.max(0, old.total - 1),
            items: old.items.filter((item) => item.id !== id),
          };
        }
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.library() });
      return true;
    }
    return false;
  }

  async function acceptUploadPolicy(): Promise<boolean> {
    setPolicySaving(true);
    setPolicyError(null);
    const res = await requestJson<{ ok: boolean; message?: string }>("/api/customer/profile", {
      method: "PATCH",
      body: JSON.stringify({ acceptUploadPolicy: true }),
    });
    setPolicySaving(false);
    if (!res.ok) {
      setPolicyError(res.message ?? "Gagal menyetujui kebijakan upload.");
      return false;
    }
    setUploadPolicyAccepted(true);
    userCheckedRef.current = true;
    setUploadPolicyModalOpened(false);
    return true;
  }

  return {
    items,
    total,
    tab,
    setTab: handleTabChange,
    search,
    setSearch: handleSearchChange,
    viewMode,
    setViewMode: handleViewModeChange,
    sortBy,
    setSortBy: handleSortByChange,
    sortOrder,
    setSortOrder: handleSortOrderChange,
    showOnly,
    setShowOnly: handleShowOnlyChange,
    isLoading,
    isFetching,
    groupedItems,
    selectedItem,
    previewOpened,
    openPreview,
    closePreview,
    refreshLibrary: () => void refetch(),
    fileInputRef,
    isUploading,
    inFlightUploads,
    openFilePicker,
    handleFileInputChange,
    deleteUpload,
    uploadPolicyAccepted,
    uploadPolicyModalOpened,
    setUploadPolicyModalOpened,
    policySaving,
    policyError,
    acceptUploadPolicy,
  };
}
