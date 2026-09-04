# Port: ObjectStorage

`packages/core` mendefinisikan port. Adapter hidup di `packages/storage`.

Wallet, job, dan worker **tidak** mengimpor `@aws-sdk/*`. Mereka menerima `ObjectStorage` dari composition root.

## Ganti backend (hanya parameter)

```
STORAGE_DRIVER=minio | s3 | r2 | memory
```

Lokal Compose: `minio`. Produksi: `s3` atau `r2`. Tes proses: `memory`.

```
createObjectStorage({ driver: "r2", endpoint, publicEndpoint, region: "auto", accessKeyId, secretAccessKey, bucket })
```

atau `createObjectStorageFromEnv()`.

Alias `S3_*` tetap dibaca jika `STORAGE_*` kosong.

## Driver baru

1. Class baru yang `implements ObjectStorage`.
2. `registerStorageDriver("gcs", (params) => new GcsStorage(params))` di composition root.
3. Jangan edit `WalletService` / `JobService`.

Jangan `if (driver === "r2")` di route atau worker.

## Kontrak

```
put({ key, body, contentType })
get(key) → { key, body, contentType }
delete(key)
signGetUrl(key, expiresSeconds) → URL yang bisa dibuka browser
```

Bucket, path-style, dan hostname internal vs publik adalah urusan adapter. `signGetUrl` memakai `STORAGE_PUBLIC_ENDPOINT` (bukan hostname Docker).
