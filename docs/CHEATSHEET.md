# Cheatsheet Operational & Development Guide

Dokumen ini berisi perintah langsung dan skrip bantu untuk menjalankan service secara terpisah serta memeriksa Redis dan Database Postgres.

---

## 1. Menjalankan Backend (BE) Saja (Port 4000)

### **A. Menggunakan Script (PowerShell / Git Bash)**
- **PowerShell:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\run-be.ps1
  ```
- **Git Bash / Linux:**
  ```bash
  ./scripts/run-be.sh
  ```
- **Mode Dev (Live Reload tanpa Docker):**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\run-be.ps1 -Dev
  ```
  *(atau di Git Bash: `./scripts/run-be.sh --dev`)*

### **B. Menggunakan Perintah Docker / pnpm Langsung**
- **Build & Rerun BE Container:**
  ```bash
  docker compose build api && docker compose up -d api redis migrate
  ```
- **Live Reload BE via pnpm:**
  ```bash
  pnpm --filter @ai-gen-free/api dev
  ```
- **Cek Health Check BE:**
  ```bash
  curl -s http://localhost:4000/health
  ```

---

## 2. Menjalankan Frontend (FE) Saja (Port 3000)

### **A. Menggunakan Script (PowerShell / Git Bash)**
- **PowerShell:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\run-fe.ps1
  ```
- **Git Bash / Linux:**
  ```bash
  ./scripts/run-fe.sh
  ```
- **Mode Dev (Live Reload tanpa Docker):**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\run-fe.ps1 -Dev
  ```
  *(atau di Git Bash: `./scripts/run-fe.sh --dev`)*

### **B. Menggunakan Perintah Docker / pnpm Langsung**
- **Build & Rerun FE Container:**
  ```bash
  docker compose build web && docker compose up -d web
  ```
- **Live Reload FE via pnpm:**
  ```bash
  pnpm --filter @ai-gen-free/web dev
  ```

---

## 3. Script Melihat Data & Kunci Redis

### **A. Menggunakan Script Helper**
- **PowerShell:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\view-redis.ps1
  ```
- **Git Bash / Linux:**
  ```bash
  ./scripts/view-redis.sh
  ```

### **B. Perintah CLI Langsung (via Container Redis)**
- **Lihat seluruh kunci Redis:**
  ```bash
  docker compose exec redis redis-cli KEYS "*"
  ```
- **Lihat kunci rate limit aktif:**
  ```bash
  docker compose exec redis redis-cli KEYS "ratelimit:*"
  ```
- **Lihat sisa waktu TTL kunci tertentu (dalam detik):**
  ```bash
  docker compose exec redis redis-cli TTL "ratelimit:login:user@gmail.com:127.0.0.1"
  ```
- **Hapus kunci rate limit tertentu (Reset Limit):**
  ```bash
  docker compose exec redis redis-cli DEL "ratelimit:login:user@gmail.com:127.0.0.1"
  ```
- **Monitor perintah Redis secara real-time:**
  ```bash
  docker compose exec redis redis-cli MONITOR
  ```

---

## 4. Script Melihat Seluruh Tabel & Data Database Postgres

### **A. Menggunakan Script Helper (Ringkasan Jumlah Data)**
- **PowerShell:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\view-db-tables.ps1
  ```
- **Git Bash / Linux:**
  ```bash
  ./scripts/view-db-tables.sh
  ```

### **B. Prisma Studio (GUI Visual Browser Database)**
Membuka antarmuka grafis (GUI) di browser untuk melihat, mengedit, dan me-review seluruh tabel database secara visual:
```bash
pnpm db:studio
```
*Atau via script:*
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\view-db-tables.ps1 -Studio
```

### **C. Menggunakan psql langsung di Container Postgres**
- **Masuk ke psql CLI:**
  ```bash
  docker compose exec postgres psql -U app -d app
  ```
- **Lihat daftar seluruh tabel:**
  ```sql
  \dt
  ```
- **Query data tabel `users` / `sessions` / `otp_challenges`:**
  ```sql
  SELECT id, email, role, email_verified_at FROM users;
  SELECT * FROM sessions;
  SELECT * FROM otp_challenges ORDER BY created_at DESC LIMIT 5;
  ```

---

## 5. Konfigurasi Git Exclude (`.gitignore`)

File [`.gitignore`](file:///D:/rnd/ai-gen-free/.gitignore) telah diperbarui dengan pola berikut:

```gitignore
node_modules
.env
.env.local
CLAUDE.local.md
.claude/CLAUDE.local.md
dist
.next
**/.next
*.log
.DS_Store
coverage
prisma/generated
tools/archify-src/

# Scratch & Local Dumps (Dikecualikan dari Git)
scratch/
*.dump
*.sql
*.tmp
.turbo
```
