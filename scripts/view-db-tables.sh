#!/usr/bin/env bash
# scripts/view-db-tables.sh
# Script untuk melihat seluruh tabel database & jumlah baris via pnpm tsx (Git Bash / Linux)

if [ "$1" == "--studio" ]; then
  echo "=== Membuka Prisma Studio (GUI Browser Database) ==="
  pnpm exec prisma studio --schema prisma/schema.prisma
elif [ "$1" == "--active" ]; then
  echo "=== User yang Sedang Aktif Login ==="
  pnpm exec tsx -e "import { prisma } from '@ai-gen-free/db'; async function run() { const s = await prisma.session.findMany({ where: { kind: 'user', expiresAt: { gt: new Date() } }, include: { user: true }, orderBy: { createdAt: 'desc' } }); console.log('=== USER AKTIF LOGIN (' + s.length + ' user) ==='); console.table(s.map(x => ({ email: x.user.email, role: x.user.role, ip: x.ip, createdAt: x.createdAt.toISOString(), expiresAt: x.expiresAt.toISOString() }))); }; run().then(() => process.exit(0));"
else
  echo "=== Melihat Seluruh Tabel Database & Jumlah Data ==="
  pnpm exec tsx -e "import { prisma } from '@ai-gen-free/db'; async function run() { console.log('--- RINGKASAN TABEL DATABASE ---'); console.log('Users              :', await prisma.user.count()); console.log('Sessions           :', await prisma.session.count()); console.log('EmailTokens        :', await prisma.emailVerificationToken.count()); console.log('OtpChallenges      :', await prisma.otpChallenge.count()); console.log('Wallets            :', await prisma.wallet.count()); console.log('Jobs               :', await prisma.job.count()); console.log('JobAssets          :', await prisma.jobAsset.count()); console.log('ModelCatalogs      :', await prisma.modelCatalog.count()); }; run().then(() => process.exit(0));"
fi
