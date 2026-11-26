"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Stack } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ErrorAlert } from "@/components/error-alert";
import { requestJson } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-keys";
import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { TemplateFormModal } from "./components/template-form-modal";
import { TemplatesTable, type TemplateNavigateOverrides } from "./components/templates-table";
import type {
  AdminTemplate,
  AdminTemplatesListResponse,
  AdminTemplatesSearchParams,
  TemplateFormPayload,
} from "./types";

export function AdminTemplatesView({
  me,
  data,
  categories,
  currentParams,
}: {
  me: unknown;
  data: AdminTemplatesListResponse;
  categories: string[];
  currentParams?: AdminTemplatesSearchParams;
}) {
  const t = useI18n("admin");
  const router = useRouter();
  const queryClient = useQueryClient();

  const currentParamsRef = useRef(currentParams);
  useEffect(() => {
    currentParamsRef.current = currentParams;
  }, [currentParams]);

  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const [pageErrorCode, setPageErrorCode] = useState<string | undefined>(undefined);
  const [pageErrorTxId, setPageErrorTxId] = useState<string | undefined>(undefined);
  const [successMessage, setSuccessMessage] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AdminTemplate | null>(null);
  const [formError, setFormError] = useState("");
  const [formErrorCode, setFormErrorCode] = useState<string | undefined>(undefined);
  const [formErrorTxId, setFormErrorTxId] = useState<string | undefined>(undefined);

  const navigateQuery = useCallback(
    (overrides: TemplateNavigateOverrides) => {
      const base = currentParamsRef.current;
      const params = new URLSearchParams();

      const nextQ = overrides.q !== undefined ? overrides.q : base?.q ?? "";
      const nextCategory =
        overrides.category !== undefined ? overrides.category : base?.category ?? "";
      const nextIsSpicy =
        overrides.isSpicy !== undefined ? overrides.isSpicy : base?.isSpicy ?? "";
      const nextIsActive =
        overrides.isActive !== undefined ? overrides.isActive : base?.isActive ?? "";
      const nextSortBy =
        overrides.sortBy !== undefined ? overrides.sortBy : base?.sortBy ?? "";
      const nextSortOrder =
        overrides.sortOrder !== undefined ? overrides.sortOrder : base?.sortOrder ?? "";
      const nextLimit =
        overrides.limit !== undefined ? String(overrides.limit) : base?.limit ?? "20";

      const filterChanged =
        overrides.q !== undefined ||
        overrides.category !== undefined ||
        overrides.isSpicy !== undefined ||
        overrides.isActive !== undefined ||
        overrides.sortBy !== undefined ||
        overrides.sortOrder !== undefined ||
        overrides.limit !== undefined;

      const nextPage =
        overrides.page !== undefined
          ? String(overrides.page)
          : filterChanged
            ? "1"
            : base?.page ?? "1";

      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (nextCategory && nextCategory !== "all") params.set("category", nextCategory);
      if (nextIsSpicy && nextIsSpicy !== "all") params.set("isSpicy", nextIsSpicy);
      if (nextIsActive && nextIsActive !== "all") params.set("isActive", nextIsActive);
      if (nextSortBy) params.set("sortBy", nextSortBy);
      if (nextSortOrder) params.set("sortOrder", nextSortOrder);
      if (nextPage && nextPage !== "1") params.set("page", nextPage);
      if (nextLimit && nextLimit !== "20") params.set("limit", nextLimit);

      const qs = params.toString();
      router.push(`/admin/templates${qs ? `?${qs}` : ""}`);
    },
    [router],
  );

  const invalidateTemplateCaches = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminTemplates() });
    void queryClient.invalidateQueries({ queryKey: ["templates"] });
    void queryClient.invalidateQueries({ queryKey: ["template-categories"] });
  }, [queryClient]);

  if (!me) return <AdminUnauth />;

  const clearFeedback = () => {
    setPageError("");
    setPageErrorCode(undefined);
    setPageErrorTxId(undefined);
    setSuccessMessage("");
  };

  const openCreateModal = () => {
    clearFeedback();
    setFormError("");
    setFormErrorCode(undefined);
    setFormErrorTxId(undefined);
    setEditingTemplate(null);
    setFormOpen(true);
  };

  const openEditModal = (template: AdminTemplate) => {
    clearFeedback();
    setFormError("");
    setFormErrorCode(undefined);
    setFormErrorTxId(undefined);
    setEditingTemplate(template);
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload: TemplateFormPayload) => {
    setBusy(true);
    setFormError("");
    setFormErrorCode(undefined);
    setFormErrorTxId(undefined);
    setSuccessMessage("");

    if (editingTemplate) {
      const res = await requestJson<AdminTemplate>(`/api/admin/templates/${editingTemplate.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setBusy(false);
      if (!res.ok) {
        setFormError(res.message);
        setFormErrorCode(res.code);
        setFormErrorTxId(res.transaction_id);
        return;
      }
      setSuccessMessage(t("templates.toast_updated", { title: payload.title }));
    } else {
      const res = await requestJson<AdminTemplate>("/api/admin/templates", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBusy(false);
      if (!res.ok) {
        setFormError(res.message);
        setFormErrorCode(res.code);
        setFormErrorTxId(res.transaction_id);
        return;
      }
      setSuccessMessage(t("templates.toast_created", { title: payload.title }));
    }

    setFormOpen(false);
    invalidateTemplateCaches();
    router.refresh();
  };

  const handleToggleActive = async (template: AdminTemplate) => {
    clearFeedback();
    setTogglingId(template.id);

    const nextActive = !template.isActive;
    const res = await requestJson<AdminTemplate>(`/api/admin/templates/${template.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: nextActive }),
    });
    setTogglingId(null);

    if (!res.ok) {
      setPageError(res.message);
      setPageErrorCode(res.code);
      setPageErrorTxId(res.transaction_id);
      return;
    }

    setSuccessMessage(
      t("templates.toast_toggled", {
        title: template.title,
        status: nextActive ? t("templates.status_active") : t("templates.status_inactive"),
      }),
    );
    invalidateTemplateCaches();
    router.refresh();
  };

  const handleDelete = async (template: AdminTemplate): Promise<boolean> => {
    clearFeedback();
    setBusy(true);

    const res = await requestJson<{ ok: boolean; id: string }>(
      `/api/admin/templates/${template.id}`,
      { method: "DELETE" },
    );
    setBusy(false);

    if (!res.ok) {
      setPageError(res.message);
      setPageErrorCode(res.code);
      setPageErrorTxId(res.transaction_id);
      return false;
    }

    setSuccessMessage(t("templates.toast_deleted", { title: template.title }));
    invalidateTemplateCaches();
    router.refresh();
    return true;
  };

  return (
    <AdminPageShell title={t("templates.title")}>
      <Stack gap="sm">
        <ErrorAlert
          message={pageError}
          code={pageErrorCode}
          transactionId={pageErrorTxId}
        />

        {successMessage ? (
          <Alert
            color="teal"
            variant="light"
            withCloseButton
            onClose={() => setSuccessMessage("")}
          >
            {successMessage}
          </Alert>
        ) : null}

        <TemplatesTable
          items={data.items}
          total={data.total}
          page={data.page}
          limit={data.limit}
          categories={categories}
          currentParams={currentParams}
          busy={busy}
          togglingId={togglingId}
          onNavigate={navigateQuery}
          onOpenCreate={openCreateModal}
          onOpenEdit={openEditModal}
          onToggleActive={handleToggleActive}
          onDelete={handleDelete}
        />
      </Stack>

      <TemplateFormModal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        template={editingTemplate}
        categories={categories}
        busy={busy}
        submitError={formError}
        submitErrorCode={formErrorCode}
        submitErrorTxId={formErrorTxId}
        onSubmit={handleFormSubmit}
      />
    </AdminPageShell>
  );
}
