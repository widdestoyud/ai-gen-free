import { AdminHomeView } from "@/views/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";

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

async function fetchInvoices(): Promise<AdminInvoiceItem[]> {
  const res = await fetchAdminApi("/api/admin/invoices");
  if (!res || !res.ok) return [];
  const data = (await res.json()) as {
    invoices?: Array<{
      id: string;
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
    }>;
  };
  return (data.invoices ?? []).map((inv) => ({
    invoiceId: inv.id,
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
  }));
}

export default async function AdminHomePage() {
  const me = await loadAdminMe();
  const [inbox, allInvoices] = me
    ? await Promise.all([notifications(), fetchInvoices()])
    : [{ pendingCount: 0, openCount: 0, items: [], openItems: [] }, []];

  return <AdminHomeView me={me} inbox={inbox} allInvoices={allInvoices} />;
}
