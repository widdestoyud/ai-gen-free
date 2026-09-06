export function formatIdr(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

export function formatDateId(iso: string): string {
  return new Date(iso).toLocaleString("id-ID");
}

export function formatCooldownHours(seconds: number): number {
  return Math.ceil(seconds / 3600);
}

export function remainingSeconds(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.ceil((t - now) / 1000));
}

export function formatDurationId(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0 && m > 0) return `${h} jam ${m} menit`;
  if (h > 0) return `${h} jam`;
  if (m > 0) return `${m} menit`;
  return `${sec} detik`;
}
