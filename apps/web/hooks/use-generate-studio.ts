"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { requestJson } from "@/lib/api";
import { remainingSeconds } from "@/lib/format";
import {
  hasLiveOutput,
  isJobActive,
  jobErrorMessage,
  signedRefreshDelayMs,
  type JobsListView,
  type JobView,
} from "@/lib/job-status";
import type { Model } from "@/views/app/generate";

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

const DEFAULT_T2I_MODEL_ID = "openai/gpt-image-2-t2i";

function pickInitialModel(catalog: Model[]): string {
  if (catalog.length === 0) return "";
  const preferred = catalog.find((m) => m.modelId === DEFAULT_T2I_MODEL_ID);
  return (preferred ?? catalog[0])!.modelId;
}

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
  const [modelId, setModelId] = useState(() => pickInitialModel(catalog));
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [imageMode, setImageMode] = useState<"t2i" | "i2i">("t2i");
  const [videoDuration, setVideoDuration] = useState<"6s" | "10s" | "15s">("6s");
  const [videoResolution, setVideoResolution] = useState<"720p" | "1080p">("720p");
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

  const [lastGeneratedJob, setLastGeneratedJob] = useState<JobView | null>(null);
  const initialActive = props.jobs.find((j) => isJobActive(j.status));
  const [activeJobId, setActiveJobId] = useState<string | null>(initialActive?.id ?? null);
  const [activeJob, setActiveJob] = useState<JobView | null>(initialActive ?? null);

  const selected =
    catalog.find((m) => m.modelId === modelId) ??
    catalog.find((m) => m.modelId === DEFAULT_T2I_MODEL_ID) ??
    catalog[0];
  const active = activeJob ?? jobs.find((j) => isJobActive(j.status));
  const isGenerating = busy || Boolean(activeJobId) || Boolean(active);
  const gallery = jobs.filter((j) => j.status === "succeeded" && hasLiveOutput(j.output));
  const cooldownLeft = remainingSeconds(cooldownUntil, now);
  const waiting = errorCode === "JOB_IN_PROGRESS" || errorCode === "COOLDOWN";
  const signedKey = jobs
    .filter((j) => hasLiveOutput(j.output) && j.output.signedExpiresAt)
    .map((j) => `${j.id}:${j.output?.signedExpiresAt ?? ""}`)
    .join("|");
  const aspectMeta = STUDIO_ASPECTS.find((item) => item.value === aspectRatio) ?? STUDIO_ASPECTS[1];

  const estimatedCost = useMemo(() => {
    if (mediaType === "video") {
      if (videoDuration === "15s") return 12;
      if (videoDuration === "10s") return 8;
      return 5;
    }
    return selected?.costPoints ?? 1;
  }, [mediaType, videoDuration, selected]);

  const canSend = prompt.trim().length > 0 && Boolean(selected) && !busy && !isGenerating && cooldownLeft <= 0;

  useEffect(() => {
    setJobs(props.jobs);
    setCooldownUntil(props.nextGenerateAt);
  }, [props.jobs, props.nextGenerateAt]);

  useEffect(() => {
    if (catalog.length === 0) return;
    if (!catalog.some((m) => m.modelId === modelId)) {
      setModelId(pickInitialModel(catalog));
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

  // Polling spesifik pada job yang sedang aktif / baru disubmit (/api/jobs/:id)
  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;

    async function pollJob() {
      const result = await requestJson<JobView>(`/api/jobs/${activeJobId}`);
      if (cancelled || !result.ok) return;
      const data = result.data;
      setActiveJob(data);

      if (data.status === "succeeded") {
        if (hasLiveOutput(data.output)) {
          setLastGeneratedJob(data);
        }
        setCooldownUntil(data.nextGenerateAt ?? null);
        setActiveJobId(null);
        setActiveJob(null);
        setJobs((prev) => [data, ...prev.filter((j) => j.id !== data.id)]);
      } else if (data.status === "failed" || data.status === "canceled") {
        setError(jobErrorMessage(data.errorCode, data.errorMessage));
        setErrorCode(data.errorCode ?? "JOB_FAILED");
        setActiveJobId(null);
        setActiveJob(null);
        setJobs((prev) => [data, ...prev.filter((j) => j.id !== data.id)]);
      }
    }

    void pollJob();
    const timer = window.setInterval(() => {
      void pollJob();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobId]);

  useEffect(() => {
    if (isGenerating || cooldownLeft <= 0) return;
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
  }, [isGenerating, cooldownLeft]);

  useEffect(() => {
    if (isGenerating) return;
    const delay = nearestSignedRefresh(jobs);
    if (delay == null) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await requestJson<JobsListView>("/api/jobs");
        if (result.ok) {
          setJobs(result.data.jobs);
          setCooldownUntil(result.data.nextGenerateAt ?? null);
        }
      })();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [isGenerating, signedKey]);

  useEffect(() => {
    if (!lastGeneratedJob) return;
    const current = jobs.find((j) => j.id === lastGeneratedJob.id);
    if (current && hasLiveOutput(current.output)) {
      setLastGeneratedJob(current);
    }
  }, [jobs, lastGeneratedJob]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setError("");
    setErrorCode("");
    setBusy(true);
    setLastGeneratedJob(null);

    const mode = mediaType === "video" ? (selectedRefs.length > 0 ? "i2v" : "t2v") : imageMode;
    const params: Record<string, unknown> = { aspectRatio };
    if (mediaType === "video") {
      params.duration = videoDuration;
      params.resolution = videoResolution;
    }
    if (selectedRefs.length > 0) {
      params.refs = selectedRefs.map((r) => r.url);
    }

    const result = await requestJson<{ job_id?: string; id?: string }>("/api/jobs", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        mode,
        modelId: selected?.modelId,
        prompt: prompt.trim(),
        params,
      }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setErrorCode(result.code ?? "");
      if (result.code === "COOLDOWN" && typeof result.retryAfterSeconds === "number") {
        setCooldownUntil(new Date(Date.now() + result.retryAfterSeconds * 1000).toISOString());
      }
      return;
    }

    const newJobId = result.data.job_id ?? result.data.id;
    if (newJobId) {
      setActiveJobId(newJobId);
      setActiveJob({
        id: newJobId,
        status: "queued",
        mode,
        modelId: selected?.modelId,
        prompt: prompt.trim(),
        cost: estimatedCost,
        progressPct: 0,
        errorCode: null,
        output: null,
        nextGenerateAt: null,
      });
    }
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
    isGenerating,
    lastGeneratedJob,
    setLastGeneratedJob,
    mediaType,
    setMediaType,
    imageMode,
    setImageMode,
    videoDuration,
    setVideoDuration,
    videoResolution,
    setVideoResolution,
    estimatedCost,
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
