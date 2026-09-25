/**
 * Utilitas Kriptografi Sisi Klien (Universal WebCrypto).
 * Pre-hashing kata sandi menggunakan SHA-256 sebelum dikirimkan lewat HTTP JSON payload (Metode A),
 * memastikan teks asli password tidak pernah muncul di inspeksi jaringan (DevTools/cURL).
 */
export async function hashPasswordClient(password: string): Promise<string> {
  if (!password) return "";
  
  // Menggunakan WebCrypto standar (globalThis.crypto) yang didukung di browser & Node.js 19+
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback darurat jika crypto.subtle tidak tersedia
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}
