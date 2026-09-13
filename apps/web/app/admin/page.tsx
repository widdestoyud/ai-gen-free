import { AdminHomeView } from "@/views/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";

async function notifications() {
  const res = await fetchAdminApi("/api/admin/notifications");
  if (!res || !res.ok) return { pendingCount: 0, items: [] as InboxItem[] };
  return (await res.json()) as { pendingCount: number; items: InboxItem[] };
}

export type InboxItem = {
  invoiceId: string;
  uniqueCode: string;
  email: string;
  amountIdr: number;
  points: number;
  proofSubmittedAt: string | null;
  status: string;
};

export default async function AdminHomePage() {
  const me = await loadAdminMe();
  const inbox = me ? await notifications() : { pendingCount: 0, items: [] };
  return <AdminHomeView me={me} inbox={inbox} />;
}
