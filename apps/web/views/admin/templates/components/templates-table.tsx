"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Modal,
  Pagination,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { EmptyState } from "@/components/empty-state";
import { ResponsiveTable } from "@/components/responsive-table";
import { useI18n } from "@/lib/i18n";
import type { AdminTemplate, AdminTemplatesSearchParams } from "../types";
import classes from "./templates-table.module.css";

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export type TemplateNavigateOverrides = {
  q?: string;
  category?: string;
  isSpicy?: string;
  isActive?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
};

export type TemplatesTableProps = {
  items: AdminTemplate[];
  total: number;
  page: number;
  limit: number;
  categories: string[];
  currentParams?: AdminTemplatesSearchParams;
  busy: boolean;
  togglingId: string | null;
  onNavigate: (overrides: TemplateNavigateOverrides) => void;
  onOpenCreate: () => void;
  onOpenEdit: (template: AdminTemplate) => void;
  onToggleActive: (template: AdminTemplate) => Promise<void>;
  onDelete: (template: AdminTemplate) => Promise<boolean>;
};

export function TemplatesTable({
  items,
  total,
  page,
  limit,
  categories,
  currentParams,
  busy,
  togglingId,
  onNavigate,
  onOpenCreate,
  onOpenEdit,
  onToggleActive,
  onDelete,
}: TemplatesTableProps) {
  const t = useI18n("admin");

  const currentQ = currentParams?.q ?? "";
  const [searchInput, setSearchInput] = useState(currentQ);
  const [deletingTemplate, setDeletingTemplate] = useState<AdminTemplate | null>(null);
  const pendingQueriesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const trimmed = currentQ.trim();
    if (pendingQueriesRef.current.has(trimmed)) {
      pendingQueriesRef.current.delete(trimmed);
      return;
    }
    setSearchInput(currentQ);
  }, [currentQ]);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === currentQ.trim()) return;
    const timer = window.setTimeout(() => {
      pendingQueriesRef.current.add(trimmed);
      onNavigate({ q: trimmed, page: 1 });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, currentQ, onNavigate]);

  const currentMode =
    currentParams?.isSpicy === "true" || currentParams?.isSpicy === "1"
      ? "true"
      : currentParams?.isSpicy === "false" || currentParams?.isSpicy === "0"
        ? "false"
        : "all";

  const currentStatus =
    currentParams?.isActive === "true" || currentParams?.isActive === "1"
      ? "true"
      : currentParams?.isActive === "false" || currentParams?.isActive === "0"
        ? "false"
        : "all";

  const currentCategory = currentParams?.category?.trim() || "all";

  const currentSortBy = currentParams?.sortBy || "createdAt";
  const defaultOrder = currentSortBy === "sortOrder" || currentSortBy === "title" ? "asc" : "desc";
  const currentSortOrder =
    currentParams?.sortOrder === "asc" || currentParams?.sortOrder === "desc"
      ? currentParams.sortOrder
      : defaultOrder;
  const currentSortKey = `${currentSortBy}:${currentSortOrder}`;

  const categoryOptions = [
    { value: "all", label: t("templates.filter_category_all") },
    ...categories.map((cat) => ({ value: cat, label: cat })),
  ];

  const hasFilters = Boolean(
    currentQ.trim() ||
      currentMode !== "all" ||
      currentCategory !== "all" ||
      currentStatus !== "all",
  );

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const startItem = total > 0 ? (page - 1) * limit + 1 : 0;
  const endItem = Math.min(page * limit, total);

  const handleConfirmDelete = async () => {
    if (!deletingTemplate) return;
    const ok = await onDelete(deletingTemplate);
    if (ok) {
      setDeletingTemplate(null);
    }
  };

  return (
    <Paper className={classes.container}>
      <div className={classes.headerRow}>
        <Stack gap={2}>
          <Text className={classes.title}>{t("templates.title")}</Text>
          <Text className={classes.subtitle}>{t("templates.subtitle")}</Text>
        </Stack>

        <Button
          size="xs"
          variant="gradient"
          gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
          leftSection={<PlusIcon />}
          onClick={onOpenCreate}
          disabled={busy}
        >
          {t("templates.add_template")}
        </Button>
      </div>

      <div className={classes.filterBar}>
        <TextInput
          size="xs"
          placeholder={t("templates.search_placeholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
          leftSection={<SearchIcon />}
          className={classes.searchInput}
        />

        <Select
          size="xs"
          value={currentMode}
          onChange={(val) => onNavigate({ isSpicy: val ?? "all", page: 1 })}
          data={[
            { value: "all", label: t("templates.filter_mode_all") },
            { value: "false", label: t("templates.filter_mode_safe") },
            { value: "true", label: t("templates.filter_mode_spicy") },
          ]}
          className={classes.filterSelect}
          allowDeselect={false}
        />

        <Select
          size="xs"
          searchable
          value={currentCategory}
          onChange={(val) => onNavigate({ category: val ?? "all", page: 1 })}
          data={categoryOptions}
          className={classes.filterSelect}
          allowDeselect={false}
        />

        <Select
          size="xs"
          value={currentStatus}
          onChange={(val) => onNavigate({ isActive: val ?? "all", page: 1 })}
          data={[
            { value: "all", label: t("templates.filter_status_all") },
            { value: "true", label: t("templates.filter_status_active") },
            { value: "false", label: t("templates.filter_status_inactive") },
          ]}
          className={classes.filterSelect}
          allowDeselect={false}
        />

        <Select
          size="xs"
          value={currentSortKey}
          onChange={(val) => {
            const [sortBy, sortOrder] = (val || "createdAt:desc").split(":");
            onNavigate({ sortBy, sortOrder, page: 1 });
          }}
          data={[
            { value: "createdAt:desc", label: t("templates.sort_newest") },
            { value: "sortOrder:asc", label: t("templates.sort_order") },
            { value: "usageCount:desc", label: t("templates.sort_popular") },
            { value: "title:asc", label: t("templates.sort_title_asc") },
            { value: "title:desc", label: t("templates.sort_title_desc") },
          ]}
          className={classes.sortSelect}
          allowDeselect={false}
        />

        <Select
          size="xs"
          value={String(limit)}
          onChange={(val) => val && onNavigate({ limit: parseInt(val, 10), page: 1 })}
          data={[
            { value: "10", label: t("templates.limit_per_page", { limit: 10 }) },
            { value: "20", label: t("templates.limit_per_page", { limit: 20 }) },
            { value: "50", label: t("templates.limit_per_page", { limit: 50 }) },
            { value: "100", label: t("templates.limit_per_page", { limit: 100 }) },
          ]}
          className={classes.limitSelect}
          allowDeselect={false}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState minHeight={220}>
          {hasFilters ? t("templates.empty_filtered") : t("templates.empty")}
        </EmptyState>
      ) : (
        <ResponsiveTable
          data={items}
          keyExtractor={(item) => item.id}
          renderHeader={() => (
            <Table.Tr className={classes.tableHeader}>
              <Table.Th>{t("templates.th_cover")}</Table.Th>
              <Table.Th>{t("templates.th_title")}</Table.Th>
              <Table.Th>{t("templates.th_category")}</Table.Th>
              <Table.Th>{t("templates.th_mode")}</Table.Th>
              <Table.Th>{t("templates.th_status")}</Table.Th>
              <Table.Th>{t("templates.th_usage")}</Table.Th>
              <Table.Th className={classes.actionCell}>{t("templates.th_actions")}</Table.Th>
            </Table.Tr>
          )}
          renderRow={(item) => (
            <Table.Tr key={item.id} className={classes.tableRow}>
              <Table.Td>
                <div className={classes.coverThumb}>
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt={item.title} className={classes.coverImg} />
                  ) : null}
                </div>
              </Table.Td>

              <Table.Td>
                <div className={classes.titleCell}>
                  <Text className={classes.templateTitle} lineClamp={1} title={item.title}>
                    {item.title}
                  </Text>
                  <div className={classes.metaRow}>
                    <Badge size="xs" variant="outline" color="gray">
                      {item.aspectRatio}
                    </Badge>
                    {item.modelId ? (
                      <Badge size="xs" variant="light" color="blue">
                        {item.modelId}
                      </Badge>
                    ) : null}
                    {item.images.length > 0 ? (
                      <Badge size="xs" variant="light" color="violet">
                        {t("templates.ref_count_badge", { count: item.images.length })}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Table.Td>

              <Table.Td>
                {item.category ? (
                  <Badge size="sm" variant="light" color="indigo">
                    {item.category}
                  </Badge>
                ) : (
                  <Text size="xs" c="dimmed">
                    —
                  </Text>
                )}
              </Table.Td>

              <Table.Td>
                <Badge
                  size="sm"
                  variant="light"
                  color={item.isSpicy ? "red" : "teal"}
                >
                  {item.isSpicy ? t("templates.mode_spicy") : t("templates.mode_safe")}
                </Badge>
              </Table.Td>

              <Table.Td>
                <Switch
                  size="sm"
                  checked={item.isActive}
                  disabled={busy || togglingId === item.id}
                  onChange={() => void onToggleActive(item)}
                  label={
                    <Badge
                      size="xs"
                      variant="light"
                      color={item.isActive ? "teal" : "gray"}
                    >
                      {item.isActive ? t("templates.status_active") : t("templates.status_inactive")}
                    </Badge>
                  }
                />
              </Table.Td>

              <Table.Td>
                <Text size="sm" className={classes.usageCell}>
                  {item.usageCount.toLocaleString("id-ID")}
                </Text>
              </Table.Td>

              <Table.Td className={classes.actionCell}>
                <Group gap="xs" justify="flex-end">
                  <Button
                    size="xs"
                    variant="light"
                    color="blue"
                    disabled={busy}
                    onClick={() => onOpenEdit(item)}
                  >
                    {t("templates.btn_edit")}
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    disabled={busy}
                    onClick={() => setDeletingTemplate(item)}
                  >
                    {t("templates.btn_delete")}
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          )}
          renderMobileCard={(item) => (
            <div key={item.id} className={classes.mobileCard}>
              <div className={classes.mobileHeader}>
                <div className={classes.mobileThumbRow}>
                  <div className={classes.coverThumb}>
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt={item.title} className={classes.coverImg} />
                    ) : null}
                  </div>
                  <div className={classes.titleCell}>
                    <Text className={classes.templateTitle} lineClamp={2}>
                      {item.title}
                    </Text>
                    <div className={classes.metaRow}>
                      <Badge size="xs" variant="light" color={item.isSpicy ? "red" : "teal"}>
                        {item.isSpicy ? t("templates.mode_spicy") : t("templates.mode_safe")}
                      </Badge>
                      <Badge size="xs" variant="outline" color="gray">
                        {item.aspectRatio}
                      </Badge>
                      {item.category ? (
                        <Badge size="xs" variant="light" color="indigo">
                          {item.category}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <Switch
                  size="xs"
                  checked={item.isActive}
                  disabled={busy || togglingId === item.id}
                  onChange={() => void onToggleActive(item)}
                  aria-label={t("templates.th_status")}
                />
              </div>

              <div className={classes.mobileMetaBar}>
                <Text size="xs" c="dimmed">
                  {t("templates.th_usage")}:{" "}
                  <Text span fw={600} c="var(--mantine-color-text)">
                    {item.usageCount.toLocaleString("id-ID")}
                  </Text>
                </Text>
                <Badge size="xs" variant="light" color={item.isActive ? "teal" : "gray"}>
                  {item.isActive ? t("templates.status_active") : t("templates.status_inactive")}
                </Badge>
              </div>

              <Group justify="flex-end" gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  disabled={busy}
                  onClick={() => onOpenEdit(item)}
                >
                  {t("templates.btn_edit")}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  disabled={busy}
                  onClick={() => setDeletingTemplate(item)}
                >
                  {t("templates.btn_delete")}
                </Button>
              </Group>
            </div>
          )}
        />
      )}

      <div className={classes.paginationRow}>
        <Text size="xs" c="dimmed">
          {t("templates.pagination_summary", {
            start: startItem,
            end: endItem,
            total,
            limit,
          })}
        </Text>

        {totalPages > 1 ? (
          <Pagination
            size="sm"
            total={totalPages}
            value={page}
            onChange={(nextPage) => onNavigate({ page: nextPage })}
          />
        ) : null}
      </div>

      <Modal
        opened={Boolean(deletingTemplate)}
        onClose={() => !busy && setDeletingTemplate(null)}
        title={t("templates.delete_title")}
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            {t("templates.delete_message", { title: deletingTemplate?.title ?? "" })}
          </Text>
          <Text size="xs" c="dimmed">
            {t("templates.delete_note")}
          </Text>
          <Group justify="flex-end" mt="md">
            <Button
              type="button"
              variant="default"
              onClick={() => setDeletingTemplate(null)}
              disabled={busy}
            >
              {t("templates.btn_cancel")}
            </Button>
            <Button
              type="button"
              color="red"
              onClick={() => void handleConfirmDelete()}
              loading={busy}
            >
              {t("templates.delete_confirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
