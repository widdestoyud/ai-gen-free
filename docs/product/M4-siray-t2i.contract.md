# M4 contract

`GenerationProvider` di `packages/core`.  
Adapter `packages/providers-siray` memakai `SIRAY_API_TOKEN`.  
Router: `ModelCatalog.mode + modelId → providerId`.  
Worker poll/status di proses worker, bukan request API.  
Token bucket di adapter; 429 Siray = delay job, bukan release poin, sampai batas retry jaringan.
