import type { JobView } from "./job-status";

export const ADMIN_PAGE_SIZE = 50;
export const GENERATE_COOLDOWN_DEFAULT = 43200;
export const GENERATE_COOLDOWN_MAX = 2_592_000;

export type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  nextGenerateAt: string | null;
  available: number;
  held: number;
  createdAt: string;
  emailVerifiedAt?: string | null;
};

export type AdminJobDetailView = JobView & {
  userId: string;
  email: string;
  purged: boolean;
  outputSha256: string | null;
  params?: unknown;
};

export type AdminJobRow = {
  id: string;
  userId: string;
  email: string;
  mode: string;
  status: string;
  modelId: string;
  cost: number;
  promptPreview: string;
  outputSha256: string | null;
  createdAt: string;
  finishedAt: string | null;
  availableUntil: string | null;
  purged: boolean;
};

export type AdminAuditItem = {
  id: string;
  actorId: string;
  actorEmail: string | null;
  action: string;
  target: string | null;
  ip: string | null;
  meta: unknown;
  createdAt: string;
};

const AUDIT_LABELS: Record<string, string> = {
  "settings.generate_cooldown_seconds.updated": "Ubah jeda generate",
  "user.cooldown.reset": "Reset jeda generate",
  "wallet.adjusted": "Penyesuaian poin",
  "invoice.proof_submitted": "Bukti transfer diunggah",
  "invoice.approved": "Invoice disetujui",
  "invoice.rejected": "Invoice ditolak",
};

export function auditActionLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action;
}

export function adminHref(path: string, params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function parseOffset(raw: string | undefined): number {
  const n = raw ? Number(raw) : 0;
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}