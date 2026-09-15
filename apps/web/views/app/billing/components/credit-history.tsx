"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Button,
  Paper,
  Select,
  Table,
  Text,
} from "@mantine/core";
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

function getSourceInfo(entry: LedgerRow): { source: string; isNegative: boolean; signedAmount: string } {
  const abs = Math.abs(entry.amount);
  if (entry.type === "capture") {
    return { source: "Task Creation", isNegative: true, signedAmount: `-${abs}` };
  }
  if (entry.type === "release" || entry.type === "refund") {
    return { source: "Refund", isNegative: false, signedAmount: `+${abs}` };
  }
  if (entry.type === "topup" || entry.type === "adjust") {
    const isNeg = entry.amount < 0;
    return {
      source: "Top Up",
      isNegative: isNeg,
      signedAmount: isNeg ? `-${abs}` : `+${abs}`,
    };
  }
  if (entry.type === "hold") {
    return { source: "Task Creation", isNegative: true, signedAmount: `-${abs}` };
  }
  // Fallback
  const isNeg = entry.amount < 0 || entry.label.toLowerCase().includes("kurang") || entry.label.toLowerCase().includes("pakai");
  return {
    source: entry.label || "Transaction",
    isNegative: isNeg,
    signedAmount: isNeg ? `-${abs}` : `+${abs}`,
  };
}

export type ComputedLedgerItem = LedgerRow & {
  formattedDate: string;
  source: string;
  isNegative: boolean;
  signedAmount: string;
  balance: number;
};

export function CreditHistory(props: {
  entries: LedgerRow[];
  currentBalance: number;
}) {
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
      const info = getSourceInfo(entry);
      const balanceAfter = bal;
      // Kurangkan efek mutasi untuk mengetahui saldo sebelum entri ini
      const delta = info.isNegative ? -Math.abs(entry.amount) : Math.abs(entry.amount);
      bal -= delta;
      return {
        ...entry,
        formattedDate: formatCreditDate(entry.createdAt),
        source: info.source,
        isNegative: info.isNegative,
        signedAmount: info.signedAmount,
        balance: balanceAfter,
      };
    });
  }, [props.entries, props.currentBalance]);

  // Filter berdasarkan channel dan type
  const filteredEntries = useMemo(() => {
    return computedEntries.filter((item) => {
      if (channelFilter && channelFilter !== "all") {
        if (item.source.toLowerCase() !== channelFilter.toLowerCase()) {
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
    const headers = ["Tanggal", "Aktivitas", "Sebanyak", "Saldo", "ID", "JobID", "InvoiceID"];
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
      <Paper className={classes.historyContainer}>
        <div className={classes.headerRow}>
          <Text className={classes.title}>Riwayat Kredit</Text>
          <div className={classes.controls}>
            <Select
              size="xs"
              value={channelFilter}
              onChange={setChannelFilter}
              data={[
                { value: "all", label: "All channels" },
                { value: "Task Creation", label: "Task Creation" },
                { value: "Refund", label: "Refund" },
                { value: "Top Up", label: "Top Up" },
              ]}
              className={classes.selectInput}
              allowDeselect={false}
            />
            <Select
              size="xs"
              value={typeFilter}
              onChange={setTypeFilter}
              data={[
                { value: "all", label: "All types" },
                { value: "deduction", label: "Deduction (-)" },
                { value: "addition", label: "Addition (+)" },
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
              Export CSV
            </Button>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <EmptyState minHeight={220}>Belum ada data riwayat transaksi.</EmptyState>
        ) : (
          <Table verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead className={classes.tableHeader}>
              <Table.Tr>
                <Table.Th>Tanggal</Table.Th>
                <Table.Th>Aktivitas</Table.Th>
                <Table.Th>Sebanyak</Table.Th>
                <Table.Th>Saldo</Table.Th>
                <Table.Th className={classes.actionCell}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredEntries.map((row) => {
                const canShowDetail = row.source !== "Refund" && row.source !== "Top Up";

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
                          aria-label="Detail transaksi"
                        >
                          <ExternalLinkIcon />
                        </ActionIcon>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
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
