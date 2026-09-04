# M5 contract

`GET/PUT /api/admin/settings/generate_cooldown_seconds`  
Kurasi pembayaran: lihat kontrak M2 (`/admin/notifications`, approve/reject).  
Worker atau cron `retention`: hapus S3 object + tandai asset expired. Jangan hapus baris `Job` / prompt / hash. Bukti transfer ikut retensi terpisah (jangan hapus selama dispute; default simpan ≥ 90 hari).

AuditLog wajib untuk setiap aksi admin.
