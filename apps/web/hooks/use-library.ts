"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { requestJson } from "@/lib/api";
import { resolveUploadUrl } from "@/lib/format";

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
};

export type CustomerLibraryResponse = {
  total: number;
  limit: number;
  offset: number;
  items: LibraryItem[];
};

export function useLibrary(props: {
  initialItems?: LibraryItem[];
  initialTotal?: number;
}) {
  const [items, setItems] = useState<LibraryItem[]>(() =>
    (props.initialItems ?? []).map((item) => ({
      ...item,
      url: resolveUploadUrl(item.url, item.id),
    }))
  );
  const [total, setTotal] = useState(props.initialTotal ?? props.initialItems?.length ?? 0);
  const [tab, setTab] = useState<LibraryTab>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<LibraryViewMode>("grid");
  const [sortBy, setSortBy] = useState<LibrarySortBy>("date");
  const [sortOrder, setSortOrder] = useState<LibrarySortOrder>("newest");
  const [showOnly, setShowOnly] = useState<LibraryShowOnly>("all");
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [previewOpened, setPreviewOpened] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPolicyAccepted, setUploadPolicyAccepted] = useState(false);
  const [uploadPolicyModalOpened, setUploadPolicyModalOpened] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userCheckedRef = useRef(false);

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

  useEffect(() => {
    if (props.initialItems && props.initialItems.length > 0) {
      setItems(
        props.initialItems.map((item) => ({
          ...item,
          url: resolveUploadUrl(item.url, item.id),
        }))
      );
    }
    if (typeof props.initialTotal === "number") {
      setTotal(props.initialTotal);
    }
    // Always trigger background fresh fetch on client mount so newly generated items appear immediately
    void fetchLibrary();
  }, [props.initialItems, props.initialTotal]);

  async function fetchLibrary(params?: {
    tab?: LibraryTab;
    search?: string;
    sortBy?: LibrarySortBy;
    sortOrder?: LibrarySortOrder;
    showOnly?: LibraryShowOnly;
  }) {
    const currentTab = params?.tab ?? tab;
    const currentSearch = params?.search ?? search;
    const currentSort = params?.sortBy ?? sortBy;
    const currentOrder = params?.sortOrder ?? sortOrder;
    const currentShowOnly = params?.showOnly ?? showOnly;

    const typeParam = currentShowOnly !== "all" ? currentShowOnly : currentTab;
    const sortParam = currentSort;
    const orderParam = currentOrder === "newest" ? "desc" : "asc";
    const qParam = currentSearch.trim();

    const query = new URLSearchParams();
    query.set("type", typeParam);
    query.set("sort", sortParam);
    query.set("order", orderParam);
    if (qParam) query.set("q", qParam);
    query.set("limit", "50");
    query.set("offset", "0");

    setIsLoading(true);
    const res = await requestJson<CustomerLibraryResponse>(`/api/library?${query.toString()}`);
    setIsLoading(false);

    if (res.ok && res.data.items) {
      setTotal(res.data.total);
      setItems(
        res.data.items.map((item) => ({
          ...item,
          url: resolveUploadUrl(item.url, item.id),
        }))
      );
    }
  }

  function handleTabChange(newTab: LibraryTab) {
    setTab(newTab);
    void fetchLibrary({ tab: newTab });
  }

  function handleSearchChange(newSearch: string) {
    setSearch(newSearch);
    void fetchLibrary({ search: newSearch });
  }

  function handleViewModeChange(newViewMode: LibraryViewMode) {
    setViewMode(newViewMode);
  }

  function handleSortByChange(newSortBy: LibrarySortBy) {
    setSortBy(newSortBy);
    void fetchLibrary({ sortBy: newSortBy });
  }

  function handleSortOrderChange(newSortOrder: LibrarySortOrder) {
    setSortOrder(newSortOrder);
    void fetchLibrary({ sortOrder: newSortOrder });
  }

  function handleShowOnlyChange(newShowOnly: LibraryShowOnly) {
    setShowOnly(newShowOnly);
    void fetchLibrary({ showOnly: newShowOnly });
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
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        await fetch("/api/customer-uploads", {
          method: "POST",
          body: formData,
        });
      } catch {}
    }
    setIsUploading(false);
    void fetchLibrary();
  }

  async function deleteUpload(id: string): Promise<boolean> {
    const res = await requestJson<{ ok?: boolean }>(`/api/customer-uploads/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      if (selectedItem?.id === id) {
        closePreview();
      }
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
    groupedItems,
    selectedItem,
    previewOpened,
    openPreview,
    closePreview,
    refreshLibrary: () => fetchLibrary(),
    fileInputRef,
    isUploading,
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
