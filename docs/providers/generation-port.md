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

## Provider kedua

Tambah paket `packages/providers-xyz`, daftar di composition root worker, isi baris katalog. **Jangan** edit `JobService`. Dummy M3 tetap adapter terpisah (`providerId=dummy`), bukan cabang di Siray.
