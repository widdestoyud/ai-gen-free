# AIDLC overlay (project slice)

Metodologi: [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (AI-DLC 2.0).  
Kita **tidak** menyalin 33 stage + 14 agen AWS ke repo ini. Slice MVP dipetakan ke 5 spesialis + 1 conductor.

## Pemetaan agen

| Agen proyek | Analog AIDLC | Stage yang dipegang |
|---|---|---|
| `orchestrator` | Conductor `/aidlc` | Routing, gerbang, audit |
| `po` | `aidlc-product-agent` | Intent, stories, acceptance |
| `sa` | `aidlc-architect-agent` | Domain, kontrak, ADR, units |
| `be` | `aidlc-developer-agent` (backend units) | Construction API/worker |
| `fe` | `aidlc-developer-agent` (frontend units) | Construction web |
| `qa` | `aidlc-quality-agent` | Tes, NFR, fail-closed |

Agen AIDLC lain (design, compliance, aws-platform, ops) **tidak** diaktifkan sampai ada kebutuhan. Jangan menambah role tanpa ADR.

## Profil

Default proyek = **MVP** AIDLC (bukan Enterprise 33 stage).

Urutan wajib:

```
Ideation (PO) → Inception (SA) → GATE manusia
  → Construction (BE, lalu FE)
  → QA → GATE manusia / merge
```

BE dan FE paralel **hanya** jika kontrak SA beku dan file ownership tidak bertabrakan (`apps/web` vs sisanya).

## Cara menjalankan

### Grok (kanonik di repo ini)

```
/workflow aidlc-mvp
```

dengan `args.intent` misalnya `M1-auth`.  
Atau sesi agent `orchestrator`, lalu biarkan ia men-spawn `po` / `sa` / `be` / `fe` / `qa`.

Definisi: `.grok/agents/*.md`, `.grok/roles/*.toml`, `.grok/workflows/aidlc-mvp.rhai`.  
Steering (semua tool): `AGENTS.md` + `.kiro/steering/` (lihat `.kiro/steering/README.md`).

### Kiro / Claude / Cursor (opsional, full engine)

Ikuti quick start upstream: clone `awslabs/aidlc-workflows`, salin `dist/<harness>/` ke mesinmu — **jangan** commit seluruh `dist/` ke repo ini. Memory metode tetap merujuk ADR di `docs/adr/`.

## Artefak per unit

| File | Penulis |
|---|---|
| `docs/product/<id>.md` | PO |
| `docs/product/<id>.contract.md` | SA |
| `docs/qa/<id>.md` | QA |
| Kode sesuai ownership | BE / FE |

## Gerbang

Orchestrator tidak melewati gerbang manusia sebelum construction. QA yang `passed=false` tidak boleh dianggap selesai.
