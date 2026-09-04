---
name: archify-docs
description: >
  Validate and deliver Archify diagrams for this repo. Use when updating
  architecture, workflow, sequence, dataflow, or lifecycle docs.
---

# Archify in this repo

Source JSON: `docs/archify/src/`  
HTML: `docs/archify/html/`  
CLI: `tools/archify-src/archify` (clone https://github.com/tt-a1i/archify if missing).

```
node tools/archify-src/archify/bin/archify.mjs validate <type> docs/archify/src/<file>.json --quality showcase --json
node tools/archify-src/archify/bin/archify.mjs deliver <type> docs/archify/src/<file>.json docs/archify/html/<file>.html --quality showcase --json
```

Follow Archify skill rules: showcase, ≤12 primary nodes, freeze JSON after a passing deliver. Viewer UI is English; authored labels may stay mixed.

Do not claim browser visual-check unless `visual-check` was actually run.
