"use client";

import { Text } from "@mantine/core";
import { AdminLoginForm } from "./components/admin-login-form";
import { AdminPageShell } from "./components/admin-page-shell";
import { AdminInbox } from "./components/admin-inbox";
import type { AdminInvoiceItem, PaginationMeta } from "@/app/admin/page";
import { useI18n } from "@/lib/i18n";

export function AdminHomeView({
  me,
  inbox,
  allInvoices = [],
  pagination,
  currentParams,
}: {
  me: { user: { id: string; email: string; role: string } } | null;
  inbox: {
    pendingCount: number;
    openCount: number;
    items: AdminInvoiceItem[];
    openItems: AdminInvoiceItem[];
  };
  allInvoices?: AdminInvoiceItem[];
  pagination?: PaginationMeta;
  currentParams?: {
    page?: string;
    limit?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
    q?: string;
  };
}) {
  const t = useI18n("admin");
  if (!me) return <AdminLoginForm />;

  return (
    <AdminPageShell title={t("home.title")} home>
      <Text size="sm" c="dimmed" mb="xs">
        {t("home.logged_as")} <strong>{me.user.email}</strong> · {t("home.waiting_curation")}{" "}
        <strong>{inbox.pendingCount}</strong> {t("home.proof_unit")} · {t("home.open_orders")}{" "}
        <strong>{inbox.openCount}</strong> {t("home.order_unit")}
      </Text>
      <Text size="sm" c="dimmed" mb="md">
        {t("home.subtitle")}
      </Text>
      <AdminInbox
        items={inbox.items}
        openItems={inbox.openItems}
        allInvoices={allInvoices}
        pendingCount={inbox.pendingCount}
        openCount={inbox.openCount}
        pagination={pagination}
        currentParams={currentParams}
      />
    </AdminPageShell>
  );
}
