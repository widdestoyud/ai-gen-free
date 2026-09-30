import type { Metadata } from "next";
import { AdminAuditPageView } from "@/views/admin/audit";
import type { AdminAuditItem } from "@/lib/admin";
import type { PaginationMeta } from "@/app/admin/page";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Audit Log Aktivitas",
  description: "Log jejak aktivitas dan audit admin.",
  robots: { index: false, follow: false },
};

async function loadAudit(params?: {
  action?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{ items: AdminAuditItem[]; pagination: PaginationMeta }> {
  const query = new URLSearchParams();
  if (params?.action && params.action !== "all") query.set("action", params.action);
  if (params?.page) query.set("page", params.page);
  if (params?.limit) query.set("limit", params.limit);
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortOrder) query.set("sortOrder", params.sortOrder);

  const qs = query.toString();
  const res = await fetchAdminApi(`/api/admin/audit${qs ? `?${qs}` : ""}`);
  if (!res || !res.ok) {
    return {
      items: [],
      pagination: {
        page: Number(params?.page ?? 1),
        limit: Number(params?.limit ?? 10),
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
  }
  const data = (await res.json()) as {
    items?: AdminAuditItem[];
    logs?: AdminAuditItem[];
    pagination?: PaginationMeta;
  };
  const list = data.items ?? data.logs ?? [];
  return {
    items: list,
    pagination: data.pagination ?? {
      page: Number(params?.page ?? 1),
      limit: Number(params?.limit ?? 10),
      total: list.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

export default async function AdminAuditPage(props: {
  searchParams: Promise<{
    action?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const me = await loadAdminMe();
  const searchParams = await props.searchParams;
  const result = me
    ? await loadAudit(searchParams)
    : { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false } };

  return (
    <AdminAuditPageView
      me={me}
      items={result.items}
      pagination={result.pagination}
      currentParams={searchParams}
    />
  );
}