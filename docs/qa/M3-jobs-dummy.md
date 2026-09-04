# QA — M3 jobs dummy

Runner: `node scripts/qa-m3-run.mjs` (Compose `api` + `worker` + `web` + Mailpit + MinIO).

| Case | Result | Evidence |
|---|---|---|
| Poin 0 | pass | 402 `INSUFFICIENT_POINTS` |
| Dummy gagal (`params.fail`) | pass | 202 → `failed`; saldo kembali; `nextGenerateAt` null |
| Dummy sukses | pass | 202 + hold 10; `succeeded`; saldo −10; signed URL `localhost:9000` |
| `Idempotency-Key` replay | pass | 202 job_id sama |
| Cooldown | pass | 429 `COOLDOWN` `retry_after_seconds: 43200` |
| User B GET job A | pass | 404 |
| Dua tab | pass | 202 + 409 `JOB_IN_PROGRESS` |
| `/generate` tanpa login | pass | 307 `/login` |

Capture idempoten: `capture:{jobId}` unique; worker skip jika job sudah terminal.
Storage: `STORAGE_DRIVER=minio` (bisa `s3` / `r2` / `memory` tanpa ubah job/wallet).