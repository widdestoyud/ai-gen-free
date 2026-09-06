"use client";

import { Button, Select, SimpleGrid, Text, Textarea, Title } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppLink } from "@/components/app-link";
import { CooldownText } from "@/components/cooldown-text";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { ItemCard } from "@/components/item-card";
import { JobOutput } from "@/components/job-output";
import { WaitAlert } from "@/components/wait-alert";
import { requestJson } from "@/lib/api";
import { remainingSeconds } from "@/lib/format";
import {
  hasLiveOutput,
  isJobActive,
  jobStatusLabel,
  signedRefreshDelayMs,
  type JobsListView,
  type JobView,
} from "@/lib/job-status";
import type { Model } from "./page";

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1 Persegi" },
  { value: "16:9", label: "16:9 Lebar" },
  { value: "9:16", label: "9:16 Vertikal" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
];

function t2iModels(models: Model[]): Model[] {
  return models.filter((m) => m.mode === "t2i");
}

function nearestSignedRefresh(jobs: JobView[]): number | null {
  let best: number | null = null;
  for (const job of jobs) {
    const delay = signedRefreshDelayMs(job.output);
    if (delay == null) continue;
    if (best == null || delay < best) best = delay;
  }
  return best;
}

export function GenerateClient(props: {
  available: number;
  held: number;
  models: Model[];
  jobs: JobView[];
  nextGenerateAt: string | null;
}) {
  const router = useRouter();
  const catalog = useMemo(() => t2iModels(props.models), [props.models]);
  const [jobs, setJobs] = useState(props.jobs);
  const [modelId, setModelId] = useState(catalog[0]?.modelId ?? "");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(props.nextGenerateAt);

  const selected = catalog.find((m) => m.modelId === modelId) ?? catalog[0];
  const active = jobs.find((j) => isJobActive(j.status));
  const hasActive = Boolean(active);
  const gallery = jobs.filter((j) => j.status === "succeeded" && hasLiveOutput(j.output));
  const history = jobs.filter((j) => !isJobActive(j.status) && !(j.status === "succeeded" && hasLiveOutput(j.output)));
  const cooldownLeft = remainingSeconds(cooldownUntil, now);
  const onCooldown = cooldownLeft > 0;
  const waiting = errorCode === "JOB_IN_PROGRESS" || errorCode === "COOLDOWN";
  const signedKey = jobs
    .filter((j) => hasLiveOutput(j.output) && j.output.signedExpiresAt)
    .map((j) => `${j.id}:${j.output?.signedExpiresAt ?? ""}`)
    .join("|");

  useEffect(() => {
    setJobs(props.jobs);
    setCooldownUntil(props.nextGenerateAt);
  }, [props.jobs, props.nextGenerateAt]);

  useEffect(() => {
    if (catalog.length === 0) return;
    if (!catalog.some((m) => m.modelId === modelId)) {
      setModelId(catalog[0]!.modelId);
    }
  }, [catalog, modelId]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  async function applyJobs(data: JobsListView) {
    setJobs(data.jobs);
    setCooldownUntil(data.nextGenerateAt ?? null);
  }

  async function refreshJobs() {
    const result = await requestJson<JobsListView>("/api/jobs");
    if (!result.ok) return;
    await applyJobs(result.data);
  }

  useEffect(() => {
    if (!hasActive) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        const result = await requestJson<JobsListView>("/api/jobs");
        if (cancelled || !result.ok) return;
        await applyJobs(result.data);
      })();
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hasActive]);

  useEffect(() => {
    if (hasActive || !onCooldown) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        const result = await requestJson<{ user: { nextGenerateAt: string | null } }>("/api/me");
        if (cancelled || !result.ok) return;
        setCooldownUntil(result.data.user.nextGenerateAt ?? null);
      })();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hasActive, onCooldown]);

  useEffect(() => {
    if (hasActive) return;
    const delay = nearestSignedRefresh(jobs);
    if (delay == null) return;
    const timer = window.setTimeout(() => {
      void refreshJobs();
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [hasActive, signedKey]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrorCode("");
    setBusy(true);
    const result = await requestJson<{ job_id?: string }>("/api/jobs", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        mode: "t2i",
        modelId: selected?.modelId,
        prompt,
        params: { aspectRatio },
      }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setErrorCode(result.code ?? "");
      if (result.code === "COOLDOWN" && typeof result.retryAfterSeconds === "number") {
        setCooldownUntil(new Date(Date.now() + result.retryAfterSeconds * 1000).toISOString());
      }
      await refreshJobs();
      return;
    }
    if (result.data.job_id) router.push(`/jobs/${result.data.job_id}`);
  }

  const blocked = busy || !selected || Boolean(active) || cooldownLeft > 0;

  return (
    <div>
      <Text>
        Saldo <strong>{props.available}</strong> poin
        {props.held > 0 ? ` (terkunci ${props.held})` : ""}
        {" · "}
        <AppLink href="/wallet">Dompet</AppLink>
      </Text>
      {selected ? (
        <Text c="dimmed">
          Mode t2i · {selected.displayName} · biaya <strong>{selected.costPoints}</strong> poin dari server. Poin
          dipotong hanya jika berhasil. Hasil tersimpan 14 hari.
        </Text>
      ) : (
        <EmptyState>Tidak ada model t2i aktif.</EmptyState>
      )}
      {active ? (
        <WaitAlert message="Sedang generate. Tab lain tidak bisa submit paralel.">
          <Text mt="xs">
            <AppLink href={`/jobs/${active.id}`}>Buka job</AppLink>
          </Text>
        </WaitAlert>
      ) : null}
      {cooldownLeft > 0 && !active ? <CooldownText until={cooldownUntil} /> : null}

      <form onSubmit={(e) => void onSubmit(e)}>
        {catalog.length > 1 ? (
          <Select
            label="Model"
            data={catalog.map((m) => ({
              value: m.modelId,
              label: `${m.displayName} · ${m.costPoints} poin`,
            }))}
            value={selected?.modelId ?? null}
            onChange={(value) => {
              if (value) setModelId(value);
            }}
            mt="md"
          />
        ) : null}
        <Select
          label="Rasio"
          data={ASPECT_RATIOS}
          value={aspectRatio}
          onChange={(value) => {
            if (value) setAspectRatio(value);
          }}
          mt="sm"
        />
        <Textarea
          label="Prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          required
          minRows={4}
          maxLength={4000}
          mt="md"
          mb="sm"
        />
        {waiting ? (
          <WaitAlert message={error}>
            {errorCode === "JOB_IN_PROGRESS" && active ? (
              <Text mt="xs">
                <AppLink href={`/jobs/${active.id}`}>Buka job yang sedang jalan</AppLink>
              </Text>
            ) : null}
          </WaitAlert>
        ) : (
          <ErrorAlert message={error} />
        )}
        {errorCode === "INSUFFICIENT_POINTS" || (selected && selected.costPoints > props.available) ? (
          <Text mt="xs">
            Saldo kurang dari biaya model. <AppLink href="/wallet">Isi saldo</AppLink>
          </Text>
        ) : null}
        <Button type="submit" disabled={blocked} mt="sm">
          Generate
        </Button>
      </form>

      <Title order={2} mt="xl">
        Hasil kamu
      </Title>
      {gallery.length === 0 && history.length === 0 ? (
        <EmptyState>Belum ada hasil. Generate dulu.</EmptyState>
      ) : null}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt="sm">
        {gallery.map((job) => (
          <ItemCard key={job.id}>
            <Text lineClamp={2}>{job.prompt}</Text>
            {job.output?.url ? (
              <JobOutput url={job.output.url} availableUntil={job.output.availableUntil} maw={320} />
            ) : null}
            <AppLink href={`/jobs/${job.id}`}>Detail</AppLink>
          </ItemCard>
        ))}
      </SimpleGrid>
      {history.length > 0 ? (
        <>
          <Title order={2} mt="xl">
            Riwayat
          </Title>
          {history.map((job) => (
            <ItemCard key={job.id}>
              <Text lineClamp={2}>{job.prompt}</Text>
              <Text size="sm" c="dimmed">
                {job.status === "succeeded" ? "File sudah tidak tersedia." : jobStatusLabel(job.status)}
              </Text>
              <AppLink href={`/jobs/${job.id}`}>Detail</AppLink>
            </ItemCard>
          ))}
        </>
      ) : null}
    </div>
  );
}
