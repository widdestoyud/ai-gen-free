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

- Base: `https://api.siray.ai/`
- Auth: `Authorization: Bearer ${SIRAY_API_TOKEN}`
- Image: endpoint image-generation (async `task_id`, poll)
- Video: `POST /v1/video/generations` → `task_id`

Jangan pakai `client.image.run()` yang blocking di dalam request API. Blocking poll **hanya** di worker, atau poll non-block berulang.

## Provider kedua

Tambah paket `packages/providers-xyz`, daftar di composition root worker, isi baris katalog. **Jangan** edit `JobService`.
