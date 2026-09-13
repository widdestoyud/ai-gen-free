"use client";

import { Progress, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { AppLink } from "@/components/app-link";
import { CooldownText } from "@/components/cooldown-text";
import { ErrorAlert } from "@/components/error-alert";
import { JobOutput } from "./job-output";
import { requestJson } from "@/lib/api";
import { formatDateId } from "@/lib/format";
import {
  hasLiveOutput,
  isJobActive,
  isJobTerminal,
  jobErrorMessage,
  jobStatusLabel,
  signedRefreshDelayMs,
  type JobView,
} from "@/lib/job-status";

export function JobClient({ initial }: { initial: JobView }) {
  const [job, setJob] = useState(initial);
  const [userNextGenerateAt, setUserNextGenerateAt] = useState<string | null>(initial.nextGenerateAt);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const result = await requestJson<JobView>(`/api/jobs/${job.id}`);
      if (!cancelled && result.ok) setJob(result.data);
    }

    if (!isJobTerminal(job.status)) {
      const timer = window.setInterval(() => {
        void refresh();
      }, 1500);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }

    const delay = signedRefreshDelayMs(job.output);
    if (delay == null) return;
    const timer = window.setTimeout(() => {
      void refresh();
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [job.id, job.status, job.output?.url, job.output?.signedExpiresAt]);

  useEffect(() => {
    if (job.status !== "succeeded") return;
    let cancelled = false;
    async function loadMe() {
      const result = await requestJson<{ user: { nextGenerateAt: string | null } }>("/api/me");
      if (!cancelled && result.ok) setUserNextGenerateAt(result.data.user.nextGenerateAt ?? null);
    }
    void loadMe();
    const timer = window.setInterval(() => {
      void loadMe();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [job.status]);

  return (
    <div>
      <Text>
        Status: <strong>{jobStatusLabel(job.status)}</strong> · {job.progressPct}%
      </Text>
      <Text c="dimmed">{job.prompt}</Text>
      {job.createdAt ? (
        <Text c="dimmed" size="sm">
          Dibuat: {formatDateId(job.createdAt)}
        </Text>
      ) : null}
      {job.finishedAt ? (
        <Text c="dimmed" size="sm">
          Selesai: {formatDateId(job.finishedAt)}
        </Text>
      ) : null}
      {isJobActive(job.status) ? (
        <>
          {job.status === "queued" && job.queuePosition != null ? (
            <Text>Posisi antrean: {job.queuePosition}</Text>
          ) : null}
          <Progress value={job.progressPct} mt="sm" />
          <Text mt="sm">Boleh refresh. Job tetap jalan di server.</Text>
        </>
      ) : null}
      {job.status === "succeeded" ? (
        <div>
          <Text>Poin terpakai: {job.cost}.</Text>
          <CooldownText until={userNextGenerateAt} />
          {hasLiveOutput(job.output) ? (
            <JobOutput url={job.output.url} availableUntil={job.output.availableUntil} />
          ) : (
            <Text mt="sm">File sudah tidak tersedia.</Text>
          )}
        </div>
      ) : null}
      {job.status === "failed" ? (
        <>
          <ErrorAlert
            message={jobErrorMessage(job.errorCode, job.errorMessage)}
            code={job.errorCode}
          />
          <Text mt="sm">Kamu boleh generate lagi.</Text>
          <AppLink href="/app/generate">Generate lagi</AppLink>
        </>
      ) : null}
    </div>
  );
}
