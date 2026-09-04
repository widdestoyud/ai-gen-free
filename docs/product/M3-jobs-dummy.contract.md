# M3 contract

## Routes

`POST /api/jobs`  
Header `Idempotency-Key` wajib.  
Body: `{ mode: "t2i", prompt, params }` — **abaikan cost dari klien**.  
`202 { job_id, status, cost_held, queue_position }`

`GET /api/jobs/:id` → status, progress, `output.url` signed hanya setelah capture.  
`GET /api/jobs` → milik sendiri.

Codes: `JOB_IN_PROGRESS`, `COOLDOWN`, `INSUFFICIENT_POINTS`, `VALIDATION_ERROR`, `UNAUTHENTICATED`.

## Worker

Queue name `generate`. Payload `{ jobId }`. Dummy provider id `dummy`.  
Sukses: tulis objek MinIO → capture `capture:{jobId}` → `nextGenerateAt = now + setting`.  
Gagal: release `release:{jobId}`.

## FE

`/generate`, `/jobs/[id]`. Poll 1–2s. Jangan `fetch` lama sampai selesai.
