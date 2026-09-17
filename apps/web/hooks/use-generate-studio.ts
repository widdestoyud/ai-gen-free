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
import type { Model, DefaultGenerationModelsConfig } from "@/views/app/generate";
import {
  STUDIO_ASPECTS,
  getAspectMetadata,
  transformAspectRatioToSize,
  type AspectRatioId,
  type AspectRatioOption,
} from "@/lib/aspect-ratio";

export { STUDIO_ASPECTS, getAspectMetadata, transformAspectRatioToSize, type AspectRatioId, type AspectRatioOption };

export type StudioRef = {
  id: string;
  url: string;
  kind: "generation" | "upload";
  uploading?: boolean;
  progress?: number;
  alias?: string | null;
  name?: string;
  format?: string;
  contentType?: string;
  width?: number;
  height?: number;
  tag?: string;
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

export function resequenceRefs(refs: StudioRef[]): StudioRef[] {
  let imageCounter = 1;
  return refs.map((ref) => {
    if (ref.alias && ref.alias.trim().length > 0) {
      return { ...ref, tag: `@${ref.alias.trim()}` };
    }
    const tag = `@image${imageCounter}`;
    imageCounter++;
    return { ...ref, tag };
  });
}

export function getRefTag(ref: StudioRef, index?: number): string {
  if (ref.alias && ref.alias.trim().length > 0) {
    return `@${ref.alias.trim()}`;
  }
  if (ref.tag && ref.tag.trim().length > 0) {
    return ref.tag.startsWith("@") ? ref.tag.trim() : `@${ref.tag.trim()}`;
  }
  return typeof index === "number" ? `@image${index + 1}` : "@image1";
}

const DEFAULT_T2I_MODEL_ID = "openai/gpt-image-2-t2i";
const DEFAULT_I2I_MODEL_ID = "openai/gpt-image-2-edit";
const DEFAULT_SPICY_T2I_MODEL_ID = "bytedance/seedream-5.0-pro-t2i-spicy";
const DEFAULT_SPICY_I2I_MODEL_ID = "alibaba/qwen-image-3-edit-spicy";
const DEFAULT_I2V_MODEL_ID = "bytedance/seedance-2.5-i2v";
const DEFAULT_SPICY_I2V_MODEL_ID = "bytedance/seedance-2.0-i2v-spicy";

function pickInitialModel(
  catalog: Model[],
  mode: "t2i" | "i2i" | "t2v" | "i2v" = "t2i",
  spicyFilter: "normal" | "spicy" = "normal",
  defaults?: Partial<DefaultGenerationModelsConfig>,
): string {
  if (catalog.length === 0) return "";
  const isSpicy = spicyFilter === "spicy";
  let defaultId = "";
  if (mode === "i2v" || mode === "t2v") {
    defaultId = isSpicy
      ? (defaults?.spicyVideoModelId || DEFAULT_SPICY_I2V_MODEL_ID)
      : (defaults?.normalVideoModelId || DEFAULT_I2V_MODEL_ID);
  } else {
    defaultId = isSpicy
      ? (mode === "i2i" ? (defaults?.spicyI2iModelId || DEFAULT_SPICY_I2I_MODEL_ID) : (defaults?.spicyT2iModelId || DEFAULT_SPICY_T2I_MODEL_ID))
      : (mode === "i2i" ? (defaults?.normalI2iModelId || DEFAULT_I2I_MODEL_ID) : (defaults?.normalT2iModelId || DEFAULT_T2I_MODEL_ID));
  }
  const preferred = catalog.find((m) => m.modelId === defaultId);
  return (preferred ?? catalog.find((m) => m.mode === mode) ?? catalog[0])!.modelId;
}

function filterModels(models: Model[], mode: "t2i" | "i2i" | "t2v" | "i2v", spicyFilter: "normal" | "spicy" = "normal"): Model[] {
  let list = models;
  if (spicyFilter === "spicy") {
    const spicyOnly = models.filter((m) => m.isSpicy);
    if (spicyOnly.length > 0) list = spicyOnly;
  } else {
    const nonSpicy = models.filter((m) => !m.isSpicy);
    if (nonSpicy.length > 0) list = nonSpicy;
  }
  const forMode = list.filter((m) => m.mode === mode);
  if (forMode.length > 0) return forMode;
  return list;
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
  defaults?: Partial<DefaultGenerationModelsConfig>;
  jobs: JobView[];
  nextGenerateAt: string | null;
  initialUploads?: StudioUpload[];
  initialUploadsTotal?: number;
}) {
  const [models, setModels] = useState<Model[]>(() => props.models ?? []);
  const [defaults, setDefaults] = useState<Partial<DefaultGenerationModelsConfig> | undefined>(() => props.defaults);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [spicyModeEnabled, setSpicyModeEnabled] = useState(false);
  const [spicyFilter, setSpicyFilter] = useState<"normal" | "spicy">("normal");
  const [selectedRefs, setSelectedRefs] = useState<StudioRef[]>([]);
  const hasImageRefs = selectedRefs.length > 0;
  const effectiveMode: "t2i" | "i2i" | "t2v" | "i2v" =
    mediaType === "video" ? (hasImageRefs ? "i2v" : "t2v") : (hasImageRefs ? "i2i" : "t2i");
  const catalog = useMemo(
    () => filterModels(models, effectiveMode, spicyFilter),
    [models, effectiveMode, spicyFilter],
  );
  const [jobs, setJobs] = useState<JobView[]>(() => props.jobs ?? []);
  const [modelId, setModelId] = useState(() => pickInitialModel(catalog, effectiveMode, spicyFilter, props.defaults));
  const [videoDuration, setVideoDuration] = useState<"6s" | "10s" | "15s">("6s");
  const [videoResolution, setVideoResolution] = useState<"480p" | "720p" | "1080p">("480p");
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
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [resultModalOpened, setResultModalOpened] = useState(false);
  const [uploadPolicyAccepted, setUploadPolicyAccepted] = useState(false);
  const [uploadPolicyModalOpened, setUploadPolicyModalOpened] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const userCheckedRef = useRef(false);

  useEffect(() => {
    if (props.models) setModels(props.models);
  }, [props.models]);

  useEffect(() => {
    if (props.defaults) setDefaults(props.defaults);
  }, [props.defaults]);

  // Sync catalog & defaults real-time on client mount and focus
  useEffect(() => {
    let active = true;
    async function syncCatalog() {
      const res = await requestJson<{ models?: Model[]; defaults?: DefaultGenerationModelsConfig }>("/api/catalog/generate");
      if (active && res.ok && res.data) {
        if (res.data.models) setModels(res.data.models);
        if (res.data.defaults) setDefaults(res.data.defaults);
      }
    }
    void syncCatalog();
    const onFocus = () => void syncCatalog();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function checkUserStatus() {
    if (userCheckedRef.current) return { accepted: uploadPolicyAccepted };
    const res = await requestJson<{
      user: {
        uploadPolicyAcceptedAt: string | null;
        hasUploads?: boolean;
        nextGenerateAt: string | null;
        spicyModeEnabled?: boolean;
      };
    }>("/api/me");
    if (!res.ok || !res.data?.user) return null;
    userCheckedRef.current = true;
    const accepted = Boolean(res.data.user.uploadPolicyAcceptedAt);
    setUploadPolicyAccepted(accepted);
    if (res.data.user.spicyModeEnabled) {
      setSpicyModeEnabled(true);
    }
    return {
      accepted,
      hasUploads: res.data.user.hasUploads,
      spicyModeEnabled: res.data.user.spicyModeEnabled,
    };
  }
  const [lastGeneratedJob, setLastGeneratedJob] = useState<JobView | null>(null);
  const initialActive = (props.jobs ?? []).find((j) => isJobActive(j.status));
  const [activeJobId, setActiveJobId] = useState<string | null>(initialActive?.id ?? null);
  const [activeJob, setActiveJob] = useState<JobView | null>(initialActive ?? null);

  const isSpicy = spicyFilter === "spicy";
  const preferredDefaultId = isSpicy
    ? (effectiveMode === "i2v" || effectiveMode === "t2v"
        ? (defaults?.spicyVideoModelId || DEFAULT_SPICY_I2V_MODEL_ID)
        : effectiveMode === "i2i"
          ? (defaults?.spicyI2iModelId || DEFAULT_SPICY_I2I_MODEL_ID)
          : (defaults?.spicyT2iModelId || DEFAULT_SPICY_T2I_MODEL_ID))
    : (effectiveMode === "i2v" || effectiveMode === "t2v"
        ? (defaults?.normalVideoModelId || DEFAULT_I2V_MODEL_ID)
        : effectiveMode === "i2i"
          ? (defaults?.normalI2iModelId || DEFAULT_I2I_MODEL_ID)
          : (defaults?.normalT2iModelId || DEFAULT_T2I_MODEL_ID));

  const selected =
    catalog.find((m) => m.modelId === modelId) ??
    catalog.find((m) => m.modelId === preferredDefaultId) ??
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
    const offset = Math.max(0, (page - 1) * 15);
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
    }>(`/api/customer-images?limit=15&offset=${offset}`);
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

  const prevModeRef = useRef(effectiveMode);
  const prevSpicyRef = useRef(spicyFilter);

  useEffect(() => {
    if (prevModeRef.current !== effectiveMode || prevSpicyRef.current !== spicyFilter) {
      prevModeRef.current = effectiveMode;
      prevSpicyRef.current = spicyFilter;
      const nextDefault = preferredDefaultId || pickInitialModel(catalog, effectiveMode, spicyFilter, defaults);
      if (nextDefault) {
        setModelId(nextDefault);
      }
      return;
    }
    if (catalog.length === 0) return;
    if (!catalog.some((m) => m.modelId === modelId)) {
      setModelId(preferredDefaultId || pickInitialModel(catalog, effectiveMode, spicyFilter, defaults));
    }
  }, [catalog, modelId, effectiveMode, spicyFilter, defaults, preferredDefaultId]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    return () => {
      for (const item of uploads) URL.revokeObjectURL(item.url);
    };
  }, [uploads]);

  // Streaming SSE realtime spesifik pada job yang sedang aktif (/api/generate/:id/events)
  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;

    async function checkJobFallback() {
      if (cancelled) return;
      const result = await requestJson<JobView>(`/api/generate/${activeJobId}`);
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

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/generate/${activeJobId}/events`);

      eventSource.onmessage = (event) => {
        if (cancelled || !event.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.status === "running") {
            setActiveJob((prev) =>
              prev ? { ...prev, progressPct: payload.progressPct ?? prev.progressPct } : null
            );
          } else if (payload.status === "succeeded") {
            void checkJobFallback();
            eventSource?.close();
          } else if (payload.status === "failed" || payload.status === "canceled") {
            setError(jobErrorMessage(payload.errorCode, payload.errorMessage));
            setErrorCode(payload.errorCode ?? "JOB_FAILED");
            setActiveJobId(null);
            setActiveJob(null);
            eventSource?.close();
            void (async () => {
              const res = await requestJson<JobView>(`/api/generate/${activeJobId}`);
              if (res.ok) setJobs((prev) => [res.data, ...prev.filter((j) => j.id !== res.data.id)]);
            })();
          }
        } catch {
          void checkJobFallback();
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        if (!cancelled) {
          void checkJobFallback();
        }
      };
    } catch {
      void checkJobFallback();
    }

    return () => {
      cancelled = true;
      if (eventSource) {
        eventSource.close();
      }
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

    const mode = mediaType === "video" ? (hasImageRefs ? "i2v" : "t2v") : (hasImageRefs ? "i2i" : "t2i");
    const targetModelId =
      selected?.modelId ||
      preferredDefaultId ||
      pickInitialModel(catalog, mode, spicyFilter, defaults) ||
      (mode === "i2v" || mode === "t2v"
        ? (isSpicy ? DEFAULT_SPICY_I2V_MODEL_ID : DEFAULT_I2V_MODEL_ID)
        : isSpicy
          ? (mode === "i2i" ? DEFAULT_SPICY_I2I_MODEL_ID : DEFAULT_SPICY_T2I_MODEL_ID)
          : (mode === "i2i" ? DEFAULT_I2I_MODEL_ID : DEFAULT_T2I_MODEL_ID));

    const currentAspectMeta = getAspectMetadata(aspectRatio);
    const params: Record<string, unknown> = {
      aspectRatio: currentAspectMeta.value,
      size: currentAspectMeta.dimension,
      tierSize: currentAspectMeta.tierSize,
    };
    if (mediaType === "video") {
      params.duration = videoDuration;
      params.resolution = videoResolution;
    }
    if (hasImageRefs) {
      params.refs = selectedRefs.map((r, idx) => ({
        url: r.url,
        tag: getRefTag(r, idx),
        alias: r.alias || null,
      }));
      params.image = selectedRefs[0]?.url;
      params.images = selectedRefs.map((r) => r.url);
    }

    const result = await requestJson<{ job_id?: string; id?: string }>("/api/generate", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        mode,
        modelId: targetModelId,
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
    void checkUserStatus();
  }

  function closeLibrary() {
    setLibraryOpened(false);
  }

  async function openFilePicker() {
    if (!userCheckedRef.current) {
      const status = await checkUserStatus();
      if (status && !status.accepted) {
        setUploadPolicyModalOpened(true);
        return;
      }
    } else if (!uploadPolicyAccepted) {
      setUploadPolicyModalOpened(true);
      return;
    }
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
            width?: number;
            height?: number;
          };
          const finalUrl = resolveUploadUrl(data.url, data.id);
          setUploads((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    id: data.id,
                    url: finalUrl,
                    uploading: false,
                    progress: 100,
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
                    id: data.id,
                    url: finalUrl,
                    uploading: false,
                    progress: 100,
                    format: "WEBP",
                    width: data.width,
                    height: data.height,
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

    if (!uploadPolicyAccepted) {
      setUploadPolicyModalOpened(true);
      return;
    }

    const newUploads: StudioUpload[] = [];
    const newRefs: StudioRef[] = [];

    for (const file of files) {
      const tempId = `up-${crypto.randomUUID()}`;
      const localBlobUrl = URL.createObjectURL(file);
      const ext = file.name.split(".").pop()?.toUpperCase() ?? file.type.split("/")[1]?.toUpperCase() ?? "IMAGE";

      const newRef: StudioRef = {
        id: tempId,
        url: localBlobUrl,
        kind: "upload",
        uploading: true,
        progress: 0,
        name: file.name,
        format: ext,
        contentType: file.type,
      };

      newRefs.push(newRef);

      newUploads.push({
        id: tempId,
        url: localBlobUrl,
        name: file.name,
        uploading: true,
        progress: 0,
      });

      uploadFileAsync(file, tempId);
    }

    setUploads((prev) => [...newUploads, ...prev]);
    setSelectedRefs((prev) => resequenceRefs([...prev, ...newRefs]));
    setLibraryTab("uploads");
  }

  function toggleGeneration(job: JobView) {
    const url = job.output?.url;
    if (!url) return;
    const contentType = job.output?.contentType ?? "image/webp";
    const format = (contentType.split("/")[1] ?? "webp").toUpperCase();
    setSelectedRefs((prev) => {
      if (prev.some((item) => item.id === job.id)) {
        return prev.filter((item) => item.id !== job.id);
      }
      return resequenceRefs([
        ...prev,
        {
          id: job.id,
          url,
          kind: "generation",
          contentType,
          format,
          alias: job.alias ?? null,
          name: `Generation #${job.id.slice(0, 8)}`,
          width: job.output?.width ?? undefined,
          height: job.output?.height ?? undefined,
        },
      ]);
    });
  }

  function toggleUpload(item: StudioUpload) {
    if (!uploadPolicyAccepted) {
      setUploadPolicyModalOpened(true);
      return;
    }
    if (item.uploading) return;
    const ext = (item.name.split(".").pop() ?? "webp").toUpperCase();
    setSelectedRefs((prev) => {
      if (prev.some((ref) => ref.id === item.id)) {
        return prev.filter((ref) => ref.id !== item.id);
      }
      return resequenceRefs([
        ...prev,
        {
          id: item.id,
          url: item.url,
          kind: "upload",
          uploading: item.uploading,
          progress: item.progress,
          alias: item.alias,
          name: item.name,
          format: ext,
          width: item.width,
          height: item.height,
        },
      ]);
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
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                alias: updatedAlias,
                tag: updatedAlias ? `@${updatedAlias}` : r.tag,
              }
            : r
        )
      );
      return true;
    }
    setError(res.message || "Gagal mengubah alias gambar");
    return false;
  }

  async function updateJobAlias(id: string, newAlias: string): Promise<boolean> {
    const trimmed = newAlias.trim();
    const res = await requestJson<{ ok?: boolean; alias?: string | null }>(`/api/generate/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ alias: trimmed }),
    });
    if (res.ok) {
      const updatedAlias = trimmed.length > 0 ? trimmed : null;
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, alias: updatedAlias } : j))
      );
      setSelectedRefs((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                alias: updatedAlias,
                tag: updatedAlias ? `@${updatedAlias}` : r.tag,
              }
            : r
        )
      );
      return true;
    }
    setError(res.message || "Gagal mengubah alias gambar generate");
    return false;
  }

  async function updateAlias(id: string, newAlias: string, kind: "generation" | "upload" = "upload"): Promise<boolean> {
    if (kind === "generation") {
      return await updateJobAlias(id, newAlias);
    }
    return await updateUploadAlias(id, newAlias);
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

  async function acceptUploadPolicy(): Promise<boolean> {
    setPolicySaving(true);
    setPolicyError(null);
    const res = await requestJson<{ ok: boolean; message?: string }>("/api/customer/profile", {
      method: "PATCH",
      body: JSON.stringify({ acceptUploadPolicy: true }),
    });
    setPolicySaving(false);
    if (!res.ok) {
      setPolicyError(res.message ?? "Gagal menyetujui kebijakan upload.");
      return false;
    }
    setUploadPolicyAccepted(true);
    userCheckedRef.current = true;
    setUploadPolicyModalOpened(false);
    return true;
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
    uploadLimit: 15,
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
    updateJobAlias,
    updateAlias,
    isSelected,
    fileRef,
    openFilePicker,
    onFiles,
    resultModalOpened,
    openResultModal: () => setResultModalOpened(true),
    closeResultModal: () => setResultModalOpened(false),
    uploadPolicyAccepted,
    uploadPolicyModalOpened,
    setUploadPolicyModalOpened,
    policySaving,
    policyError,
    acceptUploadPolicy,
    spicyModeEnabled,
    spicyFilter,
    setSpicyFilter,
  };
}
