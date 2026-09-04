# Membuat milestone + issue dari docs/github/milestones.md
# Prasyarat: gh auth login

$ErrorActionPreference = "Stop"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh) tidak ada. Install: https://cli.github.com/ lalu gh auth login"
}

$repo = gh repo view --json nameWithOwner -q .nameWithOwner
Write-Host "Repo $repo"

foreach ($name in @("aidlc","po","sa","be","fe","qa","orch")) {
    gh label create $name --force 2>$null | Out-Null
}

$milestones = @(
    @{ title = "M0-scaffold"; desc = "Compose + monorepo packages" },
    @{ title = "M1-auth"; desc = "Email OTP, single session, admin Basic Auth" },
    @{ title = "M2-wallet"; desc = "Ledger, unggah bukti transfer, kurasi admin" },
    @{ title = "M3-jobs-dummy"; desc = "Background jobs, mutex, cooldown" },
    @{ title = "M4-siray-t2i"; desc = "GenerationProvider + Siray adapter" },
    @{ title = "M5-admin-retention"; desc = "Admin settings + 14-day media TTL" }
)

foreach ($m in $milestones) {
    $exists = gh api "repos/$repo/milestones" --jq ".[] | select(.title==\"$($m.title)\") | .number" 2>$null
    if (-not $exists) {
        gh api "repos/$repo/milestones" -f title="$($m.title)" -f description="$($m.desc)" | Out-Null
        Write-Host "Created milestone $($m.title)"
    } else {
        Write-Host "Milestone exists $($m.title)"
    }
}

$issues = @(
    @{ title = "[M0] Scaffold pnpm workspaces"; labels = "aidlc,be"; mile = "M0-scaffold" },
    @{ title = "[M0] Dockerfiles for api/worker/web"; labels = "aidlc,be"; mile = "M0-scaffold" },
    @{ title = "[M0] Prisma migrate + admin seed"; labels = "aidlc,be"; mile = "M0-scaffold" },
    @{ title = "[M1] OTP + single session"; labels = "aidlc,be"; mile = "M1-auth" },
    @{ title = "[M1] Login UI"; labels = "aidlc,fe"; mile = "M1-auth" },
    @{ title = "[M1] Admin Basic Auth + role seed"; labels = "aidlc,be"; mile = "M1-auth" },
    @{ title = "[M1] QA second-device session"; labels = "aidlc,qa"; mile = "M1-auth" },
    @{ title = "[M2] Ledger + wallet lock"; labels = "aidlc,be"; mile = "M2-wallet" },
    @{ title = "[M2] Invoice + upload payment proof"; labels = "aidlc,be"; mile = "M2-wallet" },
    @{ title = "[M2] Admin notifications + approve/reject"; labels = "aidlc,be"; mile = "M2-wallet" },
    @{ title = "[M2] Dashboard wallet + proof upload"; labels = "aidlc,fe"; mile = "M2-wallet" },
    @{ title = "[M2] Admin curation UI"; labels = "aidlc,fe"; mile = "M2-wallet" },
    @{ title = "[M2] QA no credit without approve"; labels = "aidlc,qa"; mile = "M2-wallet" },
    @{ title = "[M3] POST /jobs hold+mutex"; labels = "aidlc,be"; mile = "M3-jobs-dummy" },
    @{ title = "[M3] Dummy worker capture/release"; labels = "aidlc,be"; mile = "M3-jobs-dummy" },
    @{ title = "[M3] Job polling UI"; labels = "aidlc,fe"; mile = "M3-jobs-dummy" },
    @{ title = "[M3] QA race/cooldown/idempotent"; labels = "aidlc,qa"; mile = "M3-jobs-dummy" },
    @{ title = "[M4] Model catalog mapping"; labels = "aidlc,sa"; mile = "M4-siray-t2i" },
    @{ title = "[M4] Siray adapter"; labels = "aidlc,be"; mile = "M4-siray-t2i" },
    @{ title = "[M4] t2i form"; labels = "aidlc,fe"; mile = "M4-siray-t2i" },
    @{ title = "[M4] QA private object copy"; labels = "aidlc,qa"; mile = "M4-siray-t2i" },
    @{ title = "[M5] Settings + 14d TTL"; labels = "aidlc,be"; mile = "M5-admin-retention" },
    @{ title = "[M5] Admin panel"; labels = "aidlc,fe"; mile = "M5-admin-retention" },
    @{ title = "[M5] QA signed URL isolation"; labels = "aidlc,qa"; mile = "M5-admin-retention" }
)

foreach ($i in $issues) {
    $labelArgs = @()
    foreach ($l in ($i.labels -split ",")) { $labelArgs += @("--label", $l.Trim()) }
    gh issue create --title $i.title @labelArgs --milestone $i.mile --body "Lihat docs/github/milestones.md. Jalankan /workflow aidlc-mvp dengan intent yang sesuai."
}
