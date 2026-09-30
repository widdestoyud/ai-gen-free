import type { Metadata } from "next";
import { AdminHomeView } from "@/views/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Dashboard manajemen transaksi, verifikasi invoice, dan analitik sistem.",
  robots: { index: false, follow: false },
};

export type AdminInvoiceItem = {
  invoiceId: string;
  uniqueCode: string;
  email: string;
  amountIdr: number;
  points: number;
  proofSubmittedAt: string | null;
  status: string;
  statusLabel?: string;
  paymentMethod?: string | null;
  paymentGateway?: string | null;
  gatewayPaymentChannel?: string | null;
  gatewayExpiredAt?: string | null;
  createdAt: string;
  paidAt?: string | null;
  reviewNote?: string | null;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

// Backward-compatible alias for existing imports
export type InboxItem = AdminInvoiceItem;

async function notifications() {
  const res = await fetchAdminApi("/api/admin/notifications");
  if (!res || !res.ok) {
    return {
      pendingCount: 0,
      openCount: 0,
      items: [] as AdminInvoiceItem[],
      openItems: [] as AdminInvoiceItem[],
    };
  }
  return (await res.json()) as {
    pendingCount: number;
    openCount: number;
    items: AdminInvoiceItem[];
    openItems: AdminInvoiceItem[];
  };
}

async function fetchInvoices(params?: {
  page?: string;
  limit?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
  q?: string;
}): Promise<{ items: AdminInvoiceItem[]; pagination: PaginationMeta }> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", params.page);
  if (params?.limit) query.set("limit", params.limit);
  if (params?.status) query.set("status", params.status);
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortOrder) query.set("sortOrder", params.sortOrder);
  if (params?.q) query.set("q", params.q);

  const qs = query.toString();
  const res = await fetchAdminApi(`/api/admin/invoices${qs ? `?${qs}` : ""}`);
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
    invoices?: Array<any>;
    items?: Array<any>;
    pagination?: PaginationMeta;
  };
  const list = data.items ?? data.invoices ?? [];
  return {
    items: list.map((inv) => ({
      invoiceId: inv.id || inv.invoiceId,
      uniqueCode: inv.uniqueCode,
      email: inv.email,
      amountIdr: inv.amountIdr,
      points: inv.points,
      proofSubmittedAt: inv.proofSubmittedAt,
      status: inv.status,
      statusLabel: inv.statusLabel,
      paymentMethod: inv.paymentMethod,
      paymentGateway: inv.paymentGateway,
      gatewayPaymentChannel: inv.gatewayPaymentChannel,
      gatewayExpiredAt: inv.gatewayExpiredAt,
      createdAt: inv.createdAt,
      paidAt: inv.paidAt,
      reviewNote: inv.reviewNote,
    })),
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

export default async function AdminHomePage(props: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
    q?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const me = await loadAdminMe();
  const [inbox, invoicesData] = me
    ? await Promise.all([notifications(), fetchInvoices(searchParams)])
    : [
        { pendingCount: 0, openCount: 0, items: [], openItems: [] },
        {
          items: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
        },
      ];

  return (
    <AdminHomeView
      me={me}
      inbox={inbox}
      allInvoices={invoicesData.items}
      pagination={invoicesData.pagination}
      currentParams={searchParams}
    />
  );
}
