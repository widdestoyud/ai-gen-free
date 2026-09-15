"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { requestJson } from "@/lib/api";
import { remainingSeconds, resolveUploadUrl } from "@/lib/format";
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
  uploading?: boolean;
  progress?: number;
  alias?: string | null;
};

export type StudioUpload = {
  id: string;
  url: string;
  name: string;
  uploading?: boolean;
  progress?: number;
  error?: string;
  key?: string;
  alias?: string | null;
  width?: number;
  height?: number;
};

export function getRefTag(ref: StudioRef, index: number): string {
  if (ref.alias && ref.alias.trim().length > 0) {
    return `@${ref.alias.trim()}`;
  }
  return `@image${index + 1}`;
}

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
  initialUploads?: StudioUpload[];
  initialUploadsTotal?: number;
}) {
  const catalog = useMemo(() => t2iModels(props.models ?? []), [props.models]);
  const [jobs, setJobs] = useState<JobView[]>(() => props.jobs ?? []);
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
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(props.nextGenerateAt ?? null);
  const [libraryOpened, setLibraryOpened] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"generations" | "uploads">("generations");
  const [uploads, setUploads] = useState<StudioUpload[]>(() => props.initialUploads ?? []);
  const [uploadPage, setUploadPage] = useState(1);
  const [uploadTotal, setUploadTotal] = useState(() => props.initialUploadsTotal ?? props.initialUploads?.length ?? 0);
  const [isUploadsLoading, setIsUploadsLoading] = useState(false);
  const [selectedRefs, setSelectedRefs] = useState<StudioRef[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [resultModalOpened, setResultModalOpened] = useState(false);
  const [lastGeneratedJob, setLastGeneratedJob] = useState<JobView | null>(null);
  const initialActive = (props.jobs ?? []).find((j) => isJobActive(j.status));
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

  useEffect(() => {
    if (props.initialUploads && props.initialUploads.length > 0) {
      setUploads(props.initialUploads);
    }
    if (typeof props.initialUploadsTotal === "number") {
      setUploadTotal(props.initialUploadsTotal);
    }
  }, [props.initialUploads, props.initialUploadsTotal]);

  async function fetchUploadsPage(page = 1) {
    setIsUploadsLoading(true);
    const offset = Math.max(0, (page - 1) * 9);
    const res = await requestJson<{
      total?: number;
      limit?: number;
      offset?: number;
      items?: Array<{
        id: string;
        url: string;
        key: string;
        alias?: string | null;
        width?: number;
        height?: number;
      }>;
    }>(`/api/customer-images?limit=9&offset=${offset}`);
    setIsUploadsLoading(false);
    if (res.ok && res.data.items) {
      if (typeof res.data.total === "number") {
        setUploadTotal(res.data.total);
      }
      const loaded: StudioUpload[] = res.data.items.map((item) => ({
        id: item.id,
        url: resolveUploadUrl(item.url, item.id),
        name: item.key.split("/").pop() ?? item.id,
        key: item.key,
        alias: item.alias ?? null,
        width: item.width,
        height: item.height,
      }));
      setUploads((prev) => {
        const inFlight = prev.filter((u) => u.uploading);
        return [...inFlight, ...loaded];
      });
    }
  }

  useEffect(() => {
    if (!libraryOpened) return;
    if (libraryTab === "uploads") {
      void fetchUploadsPage(uploadPage);
    }
  }, [libraryOpened, libraryTab]);

  const estimatedCost = useMemo(() => {
    if (mediaType === "video") {
      if (videoDuration === "15s") return 12;
      if (videoDuration === "10s") return 8;
      return 5;
    }
    return selected?.costPoints ?? 1;
  }, [mediaType, videoDuration, selected]);

  const isUploadingRefs = selectedRefs.some((r) => r.uploading);
  const canSend =
    prompt.trim().length > 0 &&
    Boolean(selected) &&
    !busy &&
    !isGenerating &&
    !isUploadingRefs &&
    cooldownLeft <= 0;

  useEffect(() => {
    setJobs(props.jobs ?? []);
    setCooldownUntil(props.nextGenerateAt ?? null);
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

  // Polling spesifik pada job yang sedang aktif / baru disubmit (/api/generate/:id)
  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;

    async function pollJob() {
      const result = await requestJson<JobView>(`/api/generate/${activeJobId}`);
      if (cancelled || !result.ok) return;
      const data = result.data;
      setActiveJob(data);

      if (data.status === "succeeded") {
        if (hasLiveOutput(data.output)) {
          setLastGeneratedJob(data);
          setResultModalOpened(true);
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
        const result = await requestJson<JobsListView>("/api/generate");
        if (result.ok && result.data?.jobs) {
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

    const result = await requestJson<{ job_id?: string; id?: string }>("/api/generate", {
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

  function uploadFileAsync(file: File, tempId: string) {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/customer-uploads");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.min(99, Math.max(1, Math.round((event.loaded / event.total) * 100)));
        setUploads((prev) =>
          prev.map((item) => (item.id === tempId ? { ...item, progress: pct } : item))
        );
        setSelectedRefs((prev) =>
          prev.map((item) => (item.id === tempId ? { ...item, progress: pct } : item))
        );
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as {
            id: string;
            url: string;
            key: string;
            alias?: string | null;
            width?: number;
            height?: number;
          };
          const finalUrl = resolveUploadUrl(data.url, data.id);
          setUploads((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    url: finalUrl,
                    uploading: false,
                    progress: 100,
                    key: data.key,
                    alias: data.alias ?? null,
                    width: data.width,
                    height: data.height,
                  }
                : item
            )
          );
          setSelectedRefs((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    url: finalUrl,
                    uploading: false,
                    progress: 100,
                    alias: data.alias ?? null,
                  }
                : item
            )
          );
        } catch {
          handleUploadError(tempId, "Gagal memproses respon berkas unggahan");
        }
      } else {
        let msg = "Gagal mengunggah berkas";
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.error?.message) msg = parsed.error.message;
        } catch {}
        handleUploadError(tempId, msg);
      }
    };

    xhr.onerror = () => {
      handleUploadError(tempId, "Gagal terhubung ke server saat mengunggah berkas");
    };

    xhr.send(formData);
  }

  function handleUploadError(tempId: string, message: string) {
    setError(message);
    setUploads((prev) =>
      prev.map((item) =>
        item.id === tempId ? { ...item, uploading: false, error: message } : item
      )
    );
    setSelectedRefs((prev) => prev.filter((item) => item.id !== tempId));
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const newUploads: StudioUpload[] = [];
    const newRefs: StudioRef[] = [];

    for (const file of files) {
      const tempId = `up-${crypto.randomUUID()}`;
      const localBlobUrl = URL.createObjectURL(file);

      newUploads.push({
        id: tempId,
        url: localBlobUrl,
        name: file.name,
        uploading: true,
        progress: 0,
      });

      newRefs.push({
        id: tempId,
        url: localBlobUrl,
        kind: "upload",
        uploading: true,
        progress: 0,
      });

      uploadFileAsync(file, tempId);
    }

    setUploads((prev) => [...newUploads, ...prev]);
    setSelectedRefs((prev) => [...prev, ...newRefs]);
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
    if (item.uploading) return;
    setSelectedRefs((prev) => {
      if (prev.some((ref) => ref.id === item.id)) {
        return prev.filter((ref) => ref.id !== item.id);
      }
      return [
        ...prev,
        {
          id: item.id,
          url: item.url,
          kind: "upload",
          uploading: item.uploading,
          progress: item.progress,
          alias: item.alias,
        },
      ];
    });
  }

  async function deleteUpload(id: string): Promise<boolean> {
    const res = await requestJson<{ ok?: boolean }>(`/api/customer-uploads/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setUploads((prev) => prev.filter((u) => u.id !== id));
      setSelectedRefs((prev) => prev.filter((r) => r.id !== id));
      setUploadTotal((prev) => Math.max(0, prev - 1));
      void fetchUploadsPage(uploadPage);
      return true;
    }
    setError(res.message || "Gagal menghapus gambar");
    return false;
  }

  async function updateUploadAlias(id: string, newAlias: string): Promise<boolean> {
    const trimmed = newAlias.trim();
    const res = await requestJson<{ ok?: boolean; alias?: string | null }>(`/api/customer-uploads/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ alias: trimmed }),
    });
    if (res.ok) {
      const updatedAlias = trimmed.length > 0 ? trimmed : null;
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, alias: updatedAlias } : u))
      );
      setSelectedRefs((prev) =>
        prev.map((r) => (r.id === id ? { ...r, alias: updatedAlias } : r))
      );
      return true;
    }
    setError(res.message || "Gagal mengubah alias gambar");
    return false;
  }

  function removeRef(id: string) {
    setSelectedRefs((prev) => prev.filter((item) => item.id !== id));
  }

  function isSelected(id: string) {
    return selectedRefs.some((item) => item.id === id);
  }

  function insertImageTag(index: number) {
    const ref = selectedRefs[index];
    if (!ref) return;
    const tag = getRefTag(ref, index);
    setPrompt((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return `${tag} `;
      if (prev.endsWith(" ")) return `${prev}${tag} `;
      return `${prev} ${tag} `;
    });
  }

  function handlePromptChange(val: string, cursorIndex?: number) {
    setPrompt(val);

    const pos = cursorIndex ?? val.length;
    const textBeforeCursor = val.slice(0, pos);
    const match = textBeforeCursor.match(/@[^\s@]*$/);

    if (match && selectedRefs.length > 0) {
      setMentionOpen(true);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
    }
  }

  function selectMention(idx: number) {
    const ref = selectedRefs[idx];
    if (!ref) return;
    const tag = `${getRefTag(ref, idx)} `;
    const textarea = textareaRef.current;
    const pos = textarea?.selectionStart ?? prompt.length;
    const textBefore = prompt.slice(0, pos);
    const textAfter = prompt.slice(pos);
    const match = textBefore.match(/@[^\s@]*$/);

    if (match) {
      const matchStart = textBefore.length - match[0].length;
      const newPrompt = textBefore.slice(0, matchStart) + tag + textAfter;
      setPrompt(newPrompt);
      setMentionOpen(false);
      setTimeout(() => {
        if (textarea) {
          const newPos = matchStart + tag.length;
          textarea.focus();
          textarea.setSelectionRange(newPos, newPos);
        }
      }, 0);
    } else {
      insertImageTag(idx);
      setMentionOpen(false);
    }
  }

  function handlePromptKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionOpen || selectedRefs.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((prev) => (prev + 1) % selectedRefs.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((prev) => (prev - 1 + selectedRefs.length) % selectedRefs.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (mentionOpen) {
        e.preventDefault();
        selectMention(mentionIndex);
      }
    } else if (e.key === "Escape") {
      setMentionOpen(false);
    }
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
    handlePromptChange,
    handlePromptKeyDown,
    textareaRef,
    mentionOpen,
    mentionIndex,
    selectMention,
    closeMention: () => setMentionOpen(false),
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
    uploadPage,
    uploadTotal,
    uploadLimit: 9,
    isUploadsLoading,
    onUploadPageChange: (p: number) => {
      setUploadPage(p);
      void fetchUploadsPage(p);
    },
    fetchUploadsPage,
    selectedRefs,
    removeRef,
    insertImageTag,
    toggleGeneration,
    toggleUpload,
    deleteUpload,
    updateUploadAlias,
    isSelected,
    fileRef,
    openFilePicker,
    onFiles,
    resultModalOpened,
    openResultModal: () => setResultModalOpened(true),
    closeResultModal: () => setResultModalOpened(false),
  };
}
