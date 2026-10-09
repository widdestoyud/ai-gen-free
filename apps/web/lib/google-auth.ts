"use client";

/**
 * Inisiasi alur Login / Daftar dengan Google secara tangguh (*resilient*).
 * Menggunakan direct POST form ke `/api/session/signin/google` dengan CSRF token segar.
 * Keunggulan:
 * - Kebal terhadap perbedaan hash Server Action pasca-deploy/restart container.
 * - Tidak akan pernah mengalami "Failed to find Server Action" atau stale bundle error.
 * - Langsung memicu pengalihan 302 native browser ke Google OAuth endpoint.
 */
export async function initiateGoogleSignIn(callbackUrl: string = "/app/generate") {
  try {
    const csrfRes = await fetch("/api/session/csrf", { cache: "no-store" });
    if (!csrfRes.ok) {
      throw new Error("Gagal mengambil token keamanan sesi.");
    }
    const data = (await csrfRes.json()) as { csrfToken?: string };
    const csrfToken = data.csrfToken;
    if (!csrfToken) {
      throw new Error("Token keamanan sesi tidak valid.");
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/session/signin/google";
    form.style.display = "none";

    const csrfInput = document.createElement("input");
    csrfInput.type = "hidden";
    csrfInput.name = "csrfToken";
    csrfInput.value = csrfToken;
    form.appendChild(csrfInput);

    const callbackInput = document.createElement("input");
    callbackInput.type = "hidden";
    callbackInput.name = "callbackUrl";
    callbackInput.value = callbackUrl.startsWith("http")
      ? callbackUrl
      : `${window.location.origin}${callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`}`;
    form.appendChild(callbackInput);

    document.body.appendChild(form);
    form.submit();
  } catch (err) {
    console.error("Gagal memulai otentikasi Google:", err);
    throw err;
  }
}
