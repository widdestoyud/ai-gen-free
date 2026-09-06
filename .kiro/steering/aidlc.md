---
inclusion: fileMatch
fileMatchPattern: ["aidlc/**", "docs/product/**", "docs/qa/**", ".grok/agents/**", ".grok/workflows/**"]
---

# AIDLC

Kanonik: `#[[file:aidlc/README.md]]`

Urutan: PO → SA → gerbang manusia → BE → FE → QA (fail-closed).

Orchestrator tidak menulis kode produk. Construction hanya setelah manusia menyetujui artefak PO+SA.

Workflow: `/workflow aidlc-mvp` dengan `intent` (contoh `M4-siray-t2i`).
