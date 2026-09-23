import { AdminJobsPageView } from "@/views/admin/jobs";
import { ADMIN_PAGE_SIZE, parseOffset, type AdminJobRow } from "@/lib/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";

async function loadJobs(opts: { q: string; status: string; mode: string; userId: string; offset: number }) {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.status) params.set("status", opts.status);
  if (opts.mode) params.set("mode", opts.mode);
  if (opts.userId) params.set("userId", opts.userId);
  params.set("limit", String(ADMIN_PAGE_SIZE));
  params.set("offset", String(opts.offset));
  const res = await fetchAdminApi(`/api/admin/jobs?${params.toString()}`);
  if (!res || !res.ok) return [] as AdminJobRow[];
  return ((await res.json()) as { jobs: AdminJobRow[] }).jobs;
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; mode?: string; userId?: string; offset?: string }>;
}) {
  const me = await loadAdminMe();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim() ?? "";
  const mode = sp.mode?.trim() ?? "";
  const userId = sp.userId?.trim() ?? "";
  const offset = parseOffset(sp.offset);
  const jobs = me ? await loadJobs({ q, status, mode, userId, offset }) : [];
  return (
    <AdminJobsPageView
      me={me}
      jobs={jobs}
      q={q}
      status={status}
      mode={mode}
      userId={userId}
      offset={offset}
    />
  );
}