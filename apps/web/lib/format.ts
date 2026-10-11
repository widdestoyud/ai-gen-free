export function formatIdr(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

const MONTH_NAMES_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_NAMES_SHORT_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES_SHORT = MONTH_NAMES_SHORT_ID;

export function formatDate(iso?: string | null, locale = "id"): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const day = d.getDate();
  const months = locale === "en" ? MONTH_NAMES_SHORT_EN : MONTH_NAMES_SHORT_ID;
  const month = months[d.getMonth()] || "";
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

export function formatDateId(iso?: string | null): string {
  return formatDate(iso, "id");
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

export function formatDuration(totalSeconds: number, locale = "id"): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (locale === "en") {
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return `${sec}s`;
  }
  if (h > 0 && m > 0) return `${h} jam ${m} menit`;
  if (h > 0) return `${h} jam`;
  if (m > 0) return `${m} menit`;
  return `${sec} detik`;
}

export function formatDurationId(totalSeconds: number): string {
  return formatDuration(totalSeconds, "id");
}

export function resolveUploadUrl(url: string | null | undefined, id?: string, thumb = false): string {
  if (!url) return id ? `/api/customer-uploads/${id}/file${thumb ? "?thumb=1" : ""}` : "";
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  let resolved = url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    resolved = url;
  } else if (url.startsWith("/customer/uploads/") || url.startsWith("/customer/generated/") || url.startsWith("/admin/uploads/")) {
    resolved = `/api${url}`;
  } else if (url.startsWith("/api/")) {
    resolved = url;
  } else {
    resolved = url.startsWith("/") ? `/api${url}` : `/api/${url}`;
  }

  if (thumb && !resolved.includes(".mp4") && !resolved.includes("video")) {
    resolved += (resolved.includes("?") ? "&" : "?") + "thumb=1";
  }

  return resolved;
}
export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()] || ""}`;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

