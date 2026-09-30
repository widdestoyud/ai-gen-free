import type { Metadata } from "next";
import { AdminJobsPageView } from "@/views/admin/jobs";
import type { AdminJobRow } from "@/lib/admin";
import type { PaginationMeta } from "@/app/admin/page";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Daftar Job Generasi AI",
  description: "Monitoring status antrean dan eksekusi job render AI.",
  robots: { index: false, follow: false },
};

async function loadJobs(params?: {
  q?: string;
  status?: string;
  mode?: string;
  userId?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{ jobs: AdminJobRow[]; pagination: PaginationMeta }> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.status && params.status !== "all") query.set("status", params.status);
  if (params?.mode && params.mode !== "all") query.set("mode", params.mode);
  if (params?.userId) query.set("userId", params.userId);
  if (params?.page) query.set("page", params.page);
  if (params?.limit) query.set("limit", params.limit);
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortOrder) query.set("sortOrder", params.sortOrder);

  const qs = query.toString();
  const res = await fetchAdminApi(`/api/admin/jobs${qs ? `?${qs}` : ""}`);
  if (!res || !res.ok) {
    return {
      jobs: [],
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
    jobs?: AdminJobRow[];
    items?: AdminJobRow[];
    pagination?: PaginationMeta;
  };
  const list = data.items ?? data.jobs ?? [];
  return {
    jobs: list,
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

export default async function AdminJobsPage(props: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    mode?: string;
    userId?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const me = await loadAdminMe();
  const searchParams = await props.searchParams;
  const result = me
    ? await loadJobs(searchParams)
    : { jobs: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false } };

  return (
    <AdminJobsPageView
      me={me}
      jobs={result.jobs}
      pagination={result.pagination}
      currentParams={searchParams}
    />
  );
}