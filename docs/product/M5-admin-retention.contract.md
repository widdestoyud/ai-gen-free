# M5 contract

`GET/PUT /api/admin/settings/generate_cooldown_seconds`  
`POST /api/admin/invoices/:id/paid` (jika belum di M2)  
Worker atau cron `retention`: hapus S3 object + tandai asset expired. Jangan hapus baris `Job` / prompt / hash.

AuditLog wajib untuk setiap aksi admin.
