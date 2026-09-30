import type { Metadata } from "next";
import { AdminUsersPageView } from "@/views/admin/users";
import type { AdminUserRow } from "@/lib/admin";
import type { PaginationMeta } from "@/app/admin/page";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Daftar Pengguna",
  description: "Manajemen data akun pengguna dan saldo sparks.",
  robots: { index: false, follow: false },
};

async function loadUsers(params?: {
  q?: string;
  role?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{ users: AdminUserRow[]; pagination: PaginationMeta }> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.role && params.role !== "all") query.set("role", params.role);
  if (params?.page) query.set("page", params.page);
  if (params?.limit) query.set("limit", params.limit);
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortOrder) query.set("sortOrder", params.sortOrder);

  const qs = query.toString();
  const res = await fetchAdminApi(`/api/admin/users${qs ? `?${qs}` : ""}`);
  if (!res || !res.ok) {
    return {
      users: [],
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
    users?: AdminUserRow[];
    items?: AdminUserRow[];
    pagination?: PaginationMeta;
  };
  const list = data.items ?? data.users ?? [];
  return {
    users: list,
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

export default async function AdminUsersPage(props: {
  searchParams: Promise<{
    q?: string;
    role?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const me = await loadAdminMe();
  const searchParams = await props.searchParams;
  const result = me ? await loadUsers(searchParams) : { users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false } };

  return (
    <AdminUsersPageView
      me={me}
      users={result.users}
      pagination={result.pagination}
      currentParams={searchParams}
    />
  );
}