# Port: GenerationProvider

`packages/core` mendefinisikan port. Adapter hidup di `packages/providers-*`.

## Capability

```
t2i | i2i | t2v | i2v | inpaint | faceswap
```

Provider menyatakan subset. Router memilih provider dari `(mode, modelId)`.

## Kontrak (konseptual)

```
interface GenerationProvider {
  readonly id: string
  readonly capabilities: Capability[]
  submit(input: CanonicalGenerateInput): Promise<ProviderHandle>
  getStatus(handle: ProviderHandle): Promise<ProviderStatus>
}

CanonicalGenerateInput {
  mode, prompt, params, inputFiles[]
}

ProviderStatus {
  state: queued | running | succeeded | failed
  progress?: number
  outputUrls?: string[]
  errorCode?: string
  raw?: unknown   // hanya log worker, jangan ke klien
}
```

Worker **menyalin** output ke bucket kita, lalu capture poin. Jangan serahkan URL Siray mentah ke browser sebagai satu-satunya salinan.

## Adapter Siray v1

Paket: `packages/providers-siray`. Hanya worker yang mengimpornya.

- Base: `SIRAY_API_BASE` default `https://api.siray.ai`
- Auth: `Authorization: Bearer ${SIRAY_API_TOKEN}` (hanya env worker; ADR 0007)
- t2i submit: `POST /v1/images/generations/async` → `data.task_id`
- t2i poll: `GET /v1/images/generations/async/{task_id}` tiap 3–5 detik
- Video (bukan M4): `POST /v1/video/generations` → `task_id`

Jangan pakai `client.image.run()` yang blocking di dalam request API atau Next.js. Poll hanya di worker.

Token bucket di adapter: 429/`ServerOverloaded`/5xx/jaringan = error retryable (BullMQ delay), **bukan** `failed` + release, sampai batas retry. 4xx policy/auth/model = terminal `failed` + release.

Status Siray `NOT_START|SUBMITTED|QUEUED` → port `queued`; `IN_PROGRESS` → `running`; `SUCCESS` → `succeeded`; `FAILURE` → `failed`.

Setelah `succeeded`, worker mengunduh `outputUrls` ke `ObjectStorage`, baru capture. Jangan teruskan URL Siray ke klien sebagai satu-satunya salinan.

Seed t2i v1: `modelId=black-forest-labs/flux-1.1-pro-t2i`, `providerId=siray`. Adapter mengisi `aspect_ratio` default `1:1` jika klien tidak mengirim.

## Aturan Aspect Ratio & Payload Model Upstream

Setiap model dan provider upstream memiliki format payload ukuran/rasio gambar yang berbeda (contoh: string enum seperti `portrait_16_9`, objek `{ width, height }`, atau format string rasio `9:16`).

1. **Mapping Kanonik**: Seluruh adapter wajib mengacu pada referensi mapping aspect ratio sistem di `apps/web/lib/aspect-ratio.ts`:
   - `9:16` -> Vertical / Portrait (misal: `portrait_16_9` atau `576x1024`)
   - `16:9` -> Widescreen / Landscape (misal: `landscape_16_9` atau `1024x576`)
   - `1:1` -> Square (`square_hd` atau `1024x1024`)
   - `2:3` -> Tall Portrait (`1024x1536` atau `832x1216`)
   - `3:2` -> Wide Landscape (`1536x1024` atau `1216x832`)
2. **Prioritas Rasio**: Adapter provider wajib memprioritaskan konversi parameter `aspectRatio` ke format yang didukung oleh model upstream tersebut, dan tidak boleh mengabaikannya atau membiarkan output fallback ke default model (seperti 1024x1024) saat rasio non-square dipilih.
3. **Uji Validasi**: Setiap penambahan model baru wajib diverifikasi output dimensinya sesuai dengan aspect ratio yang dipilih.

## Standar Pengujian Provider (Probing / Diagnostik Upstream)

Seluruh pengujian langsung (ad-hoc / probing / script evaluasi) yang dikirim ke API upstream provider wajib mematuhi standar identifikasi:

1. **Prefix Prompt Standar**:
   - Selalu berikan prefix `[TEST:DEV]` atau `[TEST:QA]` di awal string prompt, contoh:
     - `"[TEST:DEV] a cat standing on grass"`
     - `"[TEST:QA] aspect ratio 9:16 portrait validation"`
   - Ini memastikan request dapat dilacak dengan mudah di dashboard dan log provider sebagai request pengujian developer, bukan request user riil.
2. **Pencatatan Log Eksekusi**:
   - Setiap script pengujian harus mencatat: `Timestamp`, `Provider & Model Endpoint`, `Request ID`, dan `Output Dimensions/Status`.

## Provider kedua

Tambah paket `packages/providers-xyz`, daftar di composition root worker, isi baris katalog. **Jangan** edit `JobService`. Dummy M3 tetap adapter terpisah (`providerId=dummy`), bukan cabang di Siray.
