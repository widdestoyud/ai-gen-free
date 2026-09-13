/**
 * Index Struktur Halaman & View Presentation Next.js (apps/web/views)
 * 
 * Mapping rute:
 * - Landing Page: / atau /landing-page     -> views/landing/landing-view.tsx
 * - Generator:    /app/generate            -> views/app/generate/generate-view.tsx
 * - Media Lib:    /app/library             -> views/app/library/library-view.tsx
 * - Profile:      /app/profile             -> views/app/profile/profile-view.tsx
 * - Billing:      /app/billing             -> views/app/billing/billing-view.tsx
 * - Usage:        /app/usage               -> views/app/usage/usage-view.tsx
 * - Job Detail:   /jobs/[id]               -> views/jobs/job-view.tsx
 * - Admin Home:   /admin                   -> views/admin/admin-home-view.tsx
 * - Admin Users:  /admin/users             -> views/admin/users/admin-users-view.tsx
 * - Admin Jobs:   /admin/jobs              -> views/admin/jobs/admin-jobs-view.tsx
 * - Admin Config: /admin/settings          -> views/admin/settings/admin-settings-view.tsx
 * - Admin Audit:  /admin/audit             -> views/admin/audit/admin-audit-view.tsx
 */

export * from "./landing";
export * from "./app/generate";
export * from "./app/library";
export * from "./app/profile";
export * from "./app/billing";
export * from "./app/usage";
export * from "./jobs";
export * from "./admin";
export * from "./admin/users";
export * from "./admin/jobs";
export * from "./admin/settings";
export * from "./admin/audit";
