export function mergeCookie(existing: string | null, extra: string): string {
  return existing ? `${existing}; ${extra}` : extra;
}
