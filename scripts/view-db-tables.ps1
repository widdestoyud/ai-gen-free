# scripts/view-db-tables.ps1
# Script untuk melihat seluruh tabel database & jumlah baris via pnpm tsx

param(
  [switch]$Studio
)

if ($Studio) {
  Write-Host "=== Membuka Prisma Studio (GUI Browser Database) ===" -ForegroundColor Cyan
  pnpm db:studio
} else {
  Write-Host "=== Melihat Seluruh Tabel Database & Jumlah Data ===" -ForegroundColor Cyan
  pnpm exec tsx -e "import { prisma } from '@ai-gen-free/db'; async function run() { console.log('--- RINGKASAN TABEL DATABASE ---'); console.log('Users              :', await prisma.user.count()); console.log('Sessions           :', await prisma.session.count()); console.log('EmailTokens        :', await prisma.emailVerificationToken.count()); console.log('OtpChallenges      :', await prisma.otpChallenge.count()); console.log('Wallets            :', await prisma.wallet.count()); console.log('Jobs               :', await prisma.job.count()); console.log('JobAssets          :', await prisma.jobAsset.count()); console.log('ModelCatalogs      :', await prisma.modelCatalog.count()); }; run().then(() => process.exit(0));"
}
