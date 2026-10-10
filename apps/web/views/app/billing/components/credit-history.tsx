"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  LoadingOverlay,
  Pagination,
  Paper,
  Select,
  Table,
  Text,
} from "@mantine/core";
import { useI18n } from "@/lib/i18n";
import { ResponsiveTable } from "@/components/responsive-table";
import { EmptyState } from "@/components/empty-state";
import { requestJson } from "@/lib/api";
import type { JobView } from "@/lib/job-status";
import { TaskDetailModal } from "./task-detail-modal";
import type { LedgerRow } from "../types";
import classes from "./credit-history.module.css";

function DownloadIcon() {
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
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ExternalLinkIcon() {
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
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function formatCreditDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}

function getSourceInfo(entry: LedgerRow, t: (key: string) => string): { source: string; rawType: string; isNegative: boolean; signedAmount: string } {
  const abs = Math.abs(entry.amount);
  if (entry.type === "capture") {
    return { source: t("source_task_creation"), rawType: "task_creation", isNegative: true, signedAmount: `-${abs}` };
  }
  if (entry.type === "release" || entry.type === "refund") {
    return { source: t("source_refund"), rawType: "refund", isNegative: false, signedAmount: `+${abs}` };
  }
  if (entry.type === "topup" || entry.type === "adjust") {
    const isNeg = entry.amount < 0;
    return {
      source: t("source_topup"),
      rawType: "topup",
      isNegative: isNeg,
      signedAmount: isNeg ? `-${abs}` : `+${abs}`,
    };
  }
  if (entry.type === "hold") {
    return { source: t("source_task_creation"), rawType: "task_creation", isNegative: true, signedAmount: `-${abs}` };
  }
  // Fallback
  const isNeg = entry.amount < 0 || entry.label.toLowerCase().includes("kurang") || entry.label.toLowerCase().includes("pakai");
  return {
    source: entry.label || t("source_transaction"),
    rawType: "other",
    isNegative: isNeg,
    signedAmount: isNeg ? `-${abs}` : `+${abs}`,
  };
}

export type ComputedLedgerItem = LedgerRow & {
  formattedDate: string;
  source: string;
  rawType: string;
  isNegative: boolean;
  signedAmount: string;
  balance: number;
};

export function CreditHistory(props: {
  entries: LedgerRow[];
  currentBalance: number;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
}) {
  const { t } = useI18n("billing");
  const [channelFilter, setChannelFilter] = useState<string | null>("all");
  const [typeFilter, setTypeFilter] = useState<string | null>("all");
  const [selectedEntry, setSelectedEntry] = useState<ComputedLedgerItem | null>(null);
  const [jobDetail, setJobDetail] = useState<JobView | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);

  useEffect(() => {
    if (!selectedEntry?.jobId) {
      setJobDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingJob(true);
    void (async () => {
      const result = await requestJson<JobView>(`/api/generate/${selectedEntry.jobId}`);
      if (!cancelled) {
        setLoadingJob(false);
        if (result.ok) setJobDetail(result.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEntry?.jobId]);

  // Hitung running balance dari entri terbaru mundur ke terlama
  const computedEntries: ComputedLedgerItem[] = useMemo(() => {
    let bal = props.currentBalance;
    return props.entries.map((entry) => {
      const info = getSourceInfo(entry, t);
      const balanceAfter = bal;
      // Kurangkan efek mutasi untuk mengetahui saldo sebelum entri ini
      const delta = info.isNegative ? -Math.abs(entry.amount) : Math.abs(entry.amount);
      bal -= delta;
      return {
        ...entry,
        formattedDate: formatCreditDate(entry.createdAt),
        source: info.source,
        rawType: info.rawType,
        isNegative: info.isNegative,
        signedAmount: info.signedAmount,
        balance: balanceAfter,
      };
    });
  }, [props.entries, props.currentBalance, t]);

  // Filter berdasarkan channel dan type
  const filteredEntries = useMemo(() => {
    return computedEntries.filter((item) => {
      if (channelFilter && channelFilter !== "all") {
        if (item.rawType !== channelFilter) {
          return false;
        }
      }
      if (typeFilter && typeFilter !== "all") {
        if (typeFilter === "deduction" && !item.isNegative) return false;
        if (typeFilter === "addition" && item.isNegative) return false;
      }
      return true;
    });
  }, [computedEntries, channelFilter, typeFilter]);

  function exportCsv() {
    if (filteredEntries.length === 0) return;
    const headers = [t("th_date"), t("th_activity"), t("th_amount"), t("th_balance"), "ID", "JobID", "InvoiceID"];
    const rows = filteredEntries.map((e) => [
      `"${e.formattedDate}"`,
      `"${e.source}"`,
      `"${e.signedAmount}"`,
      `"${e.balance}"`,
      `"${e.id}"`,
      `"${e.jobId ?? ""}"`,
      `"${e.invoiceId ?? ""}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `credit-history-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Paper className={classes.historyContainer} pos="relative">
        <LoadingOverlay
          visible={Boolean(props.isLoading)}
          overlayProps={{ radius: "sm", blur: 1 }}
          loaderProps={{ size: "sm" }}
        />
        <div className={classes.headerRow}>
          <Text className={classes.title}>{t("credit_history_title")}</Text>
          <div className={classes.controls}>
            <Select
              size="xs"
              value={channelFilter}
              onChange={setChannelFilter}
              data={[
                { value: "all", label: t("filter_all_channels") },
                { value: "task_creation", label: t("source_task_creation") },
                { value: "refund", label: t("source_refund") },
                { value: "topup", label: t("source_topup") },
              ]}
              className={classes.selectInput}
              allowDeselect={false}
            />
            <Select
              size="xs"
              value={typeFilter}
              onChange={setTypeFilter}
              data={[
                { value: "all", label: t("filter_all_types") },
                { value: "deduction", label: t("filter_deduction") },
                { value: "addition", label: t("filter_addition") },
              ]}
              className={classes.selectInput}
              allowDeselect={false}
            />
            <Button
              size="xs"
              variant="default"
              leftSection={<DownloadIcon />}
              onClick={exportCsv}
              disabled={filteredEntries.length === 0}
            >
              {t("btn_export_csv")}
            </Button>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <EmptyState minHeight={220}>{t("empty_history")}</EmptyState>
        ) : (
          <ResponsiveTable
            data={filteredEntries}
            keyExtractor={(row) => row.id}
            renderHeader={() => (
              <Table.Tr className={classes.tableHeader}>
                <Table.Th>{t("th_date")}</Table.Th>
                <Table.Th>{t("th_activity")}</Table.Th>
                <Table.Th>{t("th_amount")}</Table.Th>
                <Table.Th>{t("th_balance")}</Table.Th>
                <Table.Th className={classes.actionCell}></Table.Th>
              </Table.Tr>
            )}
            renderRow={(row) => {
              const canShowDetail = row.rawType !== "refund" && row.rawType !== "topup";

              return (
                <Table.Tr key={row.id} className={classes.tableRow}>
                  <Table.Td className={classes.dateCell}>{row.formattedDate}</Table.Td>
                  <Table.Td className={classes.sourceCell}>{row.source}</Table.Td>
                  <Table.Td>
                    <span className={row.isNegative ? classes.amountNegative : classes.amountPositive}>
                      {row.signedAmount}
                    </span>
                  </Table.Td>
                  <Table.Td className={classes.balanceCell}>{row.balance}</Table.Td>
                  <Table.Td className={classes.actionCell}>
                    {canShowDetail ? (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={() => setSelectedEntry(row)}
                        aria-label={t("aria_detail")}
                      >
                        <ExternalLinkIcon />
                      </ActionIcon>
                    ) : null}
                  </Table.Td>
                </Table.Tr>
              );
            }}
            renderMobileCard={(row) => {
              const canShowDetail = row.rawType !== "refund" && row.rawType !== "topup";

              return (
                <div
                  key={row.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid var(--mantine-color-default-border)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text size="xs" c="dimmed" suppressHydrationWarning>
                      {row.formattedDate}
                    </Text>
                    {canShowDetail && (
                      <Button
                        variant="subtle"
                        size="compact-xs"
                        rightSection={<ExternalLinkIcon />}
                        onClick={() => setSelectedEntry(row)}
                      >
                        {t("btn_detail")}
                      </Button>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <div>
                      <Text size="xs" c="dimmed">
                        {t("mobile_activity")}
                      </Text>
                      <Text size="sm" fw={600}>
                        {row.source}
                      </Text>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Text size="xs" c="dimmed">
                        {t("mobile_mutation")}
                      </Text>
                      <span className={row.isNegative ? classes.amountNegative : classes.amountPositive}>
                        {row.signedAmount}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text size="xs" c="dimmed">
                      {t("mobile_balance")}
                    </Text>
                    <Text size="sm" fw={600} c="blue.4">
                      {t("mobile_points_unit", { count: row.balance })}
                    </Text>
                  </div>
                </div>
              );
            }}
          />
        )}

        {props.pagination && props.pagination.total > 0 && (
          <Group justify="space-between" align="center" mt="md" wrap="wrap" gap="sm">
            <Text size="xs" c="dimmed">
              {t("pagination_showing", {
                from: props.pagination.total === 0 ? 0 : (props.pagination.page - 1) * props.pagination.limit + 1,
                to: Math.min(props.pagination.page * props.pagination.limit, props.pagination.total),
                total: props.pagination.total,
              })}
            </Text>
            {props.pagination.totalPages > 1 && props.onPageChange && (
              <Pagination
                size="sm"
                total={props.pagination.totalPages}
                value={props.pagination.page}
                onChange={props.onPageChange}
                disabled={props.isLoading}
              />
            )}
          </Group>
        )}
      </Paper>

      <TaskDetailModal
        opened={Boolean(selectedEntry)}
        onClose={() => {
          setSelectedEntry(null);
          setJobDetail(null);
        }}
        job={jobDetail}
        loading={loadingJob}
        ledgerEntry={selectedEntry}
      />
    </>
  );
}
