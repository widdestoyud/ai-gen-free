const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "grr.la",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "10minutemail.net",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "nada.ltd",
  "discard.email",
  "mailnesia.com",
  "maildrop.cc",
  "throwaway.email",
  "fakeinbox.com",
  "emailondeck.com",
  "moakt.com",
]);

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmailFormat(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return DISPOSABLE.has(domain);
}
