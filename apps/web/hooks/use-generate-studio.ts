"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { requestJson } from "@/lib/api";
import { remainingSeconds } from "@/lib/format";
import {
  hasLiveOutput,
  isJobActive,
  signedRefreshDelayMs,
  type JobsListView,
  type JobView,
} from "@/lib/job-status";
import type { Model } from "@/app/generate/generate-client";

export const STUDIO_ASPECTS = [
  { value: "2:3", label: "2:3 Tall", preview: "tall" },
  { value: "3:2", label: "3:2 Wide", preview: "wide" },
  { value: "1:1", label: "1:1 Square", preview: "square" },
  { value: "9:16", label: "9:16 Vertical", preview: "tall" },
  { value: "16:9", label: "16:9 Widescreen", preview: "wide" },
] as const;

export type StudioRef = {
  id: string;
  url: string;
  kind: "generation" | "upload";
};

export type StudioUpload = {
  id: string;
  url: string;
  name: string;
};

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

export function useGenerateStudio(props: {
  available: number;
  held: number;
  models: Model[];
  jobs: JobView[];
  nextGenerateAt: string | null;
}) {
  const catalog = useMemo(() => t2iModels(props.models), [props.models]);
  const [jobs, setJobs] = useState(props.jobs);
  const [modelId, setModelId] = useState(catalog[0]?.modelId ?? "");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("3:2");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(props.nextGenerateAt);
  const [libraryOpened, setLibraryOpened] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"generations" | "uploads">("generations");
  const [uploads, setUploads] = useState<StudioUpload[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<StudioRef[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = catalog.find((m) => m.modelId === modelId) ?? catalog[0];
  const active = jobs.find((j) => isJobActive(j.status));
  const gallery = jobs.filter((j) => j.status === "succeeded" && hasLiveOutput(j.output));
  const cooldownLeft = remainingSeconds(cooldownUntil, now);
  const waiting = errorCode === "JOB_IN_PROGRESS" || errorCode === "COOLDOWN";
  const signedKey = jobs
    .filter((j) => hasLiveOutput(j.output) && j.output.signedExpiresAt)
    .map((j) => `${j.id}:${j.output?.signedExpiresAt ?? ""}`)
    .join("|");
  const aspectMeta = STUDIO_ASPECTS.find((item) => item.value === aspectRatio) ?? STUDIO_ASPECTS[1];
  const canSend = prompt.trim().length > 0 && Boolean(selected) && !busy && !active && cooldownLeft <= 0;

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

  useEffect(() => {
    return () => {
      for (const item of uploads) URL.revokeObjectURL(item.url);
    };
  }, [uploads]);

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
    if (!active) return;
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
  }, [active]);

  useEffect(() => {
    if (active || cooldownLeft <= 0) return;
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
  }, [active, cooldownLeft]);

  useEffect(() => {
    if (active) return;
    const delay = nearestSignedRefresh(jobs);
    if (delay == null) return;
    const timer = window.setTimeout(() => {
      void refreshJobs();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [active, signedKey]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setError("");
    setErrorCode("");
    setBusy(true);
    const result = await requestJson<{ job_id?: string }>("/api/jobs", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        mode: "t2i",
        modelId: selected?.modelId,
        prompt: prompt.trim(),
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
    await refreshJobs();
  }

  function openLibrary() {
    setLibraryOpened(true);
  }

  function closeLibrary() {
    setLibraryOpened(false);
  }

  function openFilePicker() {
    fileRef.current?.click();
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const next: StudioUpload[] = files.map((file) => ({
      id: `up-${crypto.randomUUID()}`,
      url: URL.createObjectURL(file),
      name: file.name,
    }));
    setUploads((prev) => [...next, ...prev]);
    setSelectedRefs((prev) => [
      ...prev,
      ...next.map((item) => ({ id: item.id, url: item.url, kind: "upload" as const })),
    ]);
    setLibraryTab("uploads");
  }

  function toggleGeneration(job: JobView) {
    const url = job.output?.url;
    if (!url) return;
    setSelectedRefs((prev) => {
      if (prev.some((item) => item.id === job.id)) {
        return prev.filter((item) => item.id !== job.id);
      }
      return [...prev, { id: job.id, url, kind: "generation" }];
    });
  }

  function toggleUpload(item: StudioUpload) {
    setSelectedRefs((prev) => {
      if (prev.some((ref) => ref.id === item.id)) {
        return prev.filter((ref) => ref.id !== item.id);
      }
      return [...prev, { id: item.id, url: item.url, kind: "upload" }];
    });
  }

  function removeRef(id: string) {
    setSelectedRefs((prev) => prev.filter((item) => item.id !== id));
  }

  function isSelected(id: string) {
    return selectedRefs.some((item) => item.id === id);
  }

  return {
    catalog,
    selected,
    jobs,
    gallery,
    active,
    prompt,
    setPrompt,
    aspectRatio,
    setAspectRatio,
    aspectMeta,
    error,
    errorCode,
    waiting,
    busy,
    cooldownUntil,
    cooldownLeft,
    canSend,
    submit,
    libraryOpened,
    openLibrary,
    closeLibrary,
    libraryTab,
    setLibraryTab,
    uploads,
    selectedRefs,
    removeRef,
    toggleGeneration,
    toggleUpload,
    isSelected,
    fileRef,
    openFilePicker,
    onFiles,
  };
}
