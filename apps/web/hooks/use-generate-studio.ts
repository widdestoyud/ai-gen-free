"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { remainingSeconds, resolveUploadUrl } from "@/lib/format";
import {
  hasLiveOutput,
  isJobActive,
  isJobImage,
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
import { uploadFileWithProgress } from "@/lib/upload";
import { queryKeys } from "@/lib/query-keys";
import { useWallet } from "./use-wallet";

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

const DEFAULT_T2I_MODEL_ID = "t2i-standard";
const DEFAULT_I2I_MODEL_ID = "i2i-standard";
const DEFAULT_SPICY_T2I_MODEL_ID = "t2i-spicy";
const DEFAULT_SPICY_I2I_MODEL_ID = "i2i-spicy";
const DEFAULT_I2V_MODEL_ID = "video-standard";
const DEFAULT_SPICY_I2V_MODEL_ID = "video-spicy";

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
  const isVideo = mode === "i2v" || mode === "t2v";
  return (
    preferred ??
    catalog.find((m) => m.mode === mode || (isVideo && (m.mode === "t2v" || m.mode === "i2v"))) ??
    catalog[0]
  )!.modelId;
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
  const isVideo = mode === "t2v" || mode === "i2v";
  const forMode = list.filter((m) => m.mode === mode || (isVideo && (m.mode === "t2v" || m.mode === "i2v")));
  if (forMode.length > 0) {
    const seen = new Set<string>();
    const result: Model[] = [];
    for (const m of forMode) {
      if (!seen.has(m.modelId)) {
        seen.add(m.modelId);
        result.push(m);
      }
    }
    return result;
  }
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

export function useGenerateStudio(props?: {
  available?: number;
  held?: number;
  models?: Model[];
  defaults?: Partial<DefaultGenerationModelsConfig>;
  jobs?: JobView[];
  nextGenerateAt?: string | null;
  initialUploads?: StudioUpload[];
  initialUploadsTotal?: number;
  initialSpicyModeEnabled?: boolean;
  initialUploadPolicyAccepted?: boolean;
}) {
  const wallet = useWallet(
    typeof props?.available === "number"
      ? { available: props.available, held: props.held ?? 0 }
      : undefined
  );
  const queryClient = useQueryClient();

  const catalogQuery = useQuery<{ models?: Model[]; defaults?: Partial<DefaultGenerationModelsConfig> }>({
    queryKey: queryKeys.catalogGenerate(),
    queryFn: async () => {
      const res = await requestJson<{ models?: Model[]; defaults?: Partial<DefaultGenerationModelsConfig> }>("/api/catalog/generate");
      if (res.ok && res.data) return res.data;
      return { models: [], defaults: undefined };
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    initialData: props?.models ? { models: props.models, defaults: props.defaults } : undefined,
  });

  const [localModels, setLocalModels] = useState<Model[] | null>(null);
  const [localDefaults, setLocalDefaults] = useState<Partial<DefaultGenerationModelsConfig> | null>(null);

  const models = localModels ?? catalogQuery.data?.models ?? props?.models ?? [];
  const defaults = localDefaults ?? catalogQuery.data?.defaults ?? props?.defaults;

  const setModels = (m: Model[] | ((prev: Model[]) => Model[])) => {
    if (typeof m === "function") {
      setLocalModels((prev) => m(prev ?? catalogQuery.data?.models ?? props?.models ?? []));
    } else {
      setLocalModels(m);
    }
  };

  const setDefaults = (d: Partial<DefaultGenerationModelsConfig> | undefined | ((prev: Partial<DefaultGenerationModelsConfig> | undefined) => Partial<DefaultGenerationModelsConfig> | undefined)) => {
    if (typeof d === "function") {
      setLocalDefaults((prev) => d(prev ?? catalogQuery.data?.defaults ?? props?.defaults) ?? null);
    } else {
      setLocalDefaults(d ?? null);
    }
  };

  const userStatusQuery = useQuery({
    queryKey: queryKeys.userStatus(),
    queryFn: async () => {
      const res = await requestJson<{
        user: {
          uploadPolicyAcceptedAt: string | null;
          hasUploads?: boolean;
          nextGenerateAt: string | null;
          spicyModeEnabled?: boolean;
        };
      }>("/api/me");
      if (res.ok && res.data?.user) return res.data.user;
      return null;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const searchParams = useSearchParams();
  const urlJobId = searchParams?.get("jobId") || null;

  const jobsQuery = useQuery<JobsListView>({
    queryKey: queryKeys.generatedJobs(),
    queryFn: async () => {
      const res = await requestJson<JobsListView>("/api/generate");
      if (res.ok && res.data) return res.data;
      return { jobs: [], nextGenerateAt: null };
    },
    staleTime: 0,
    refetchOnMount: "always",
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    initialData: props?.jobs ? { jobs: props.jobs, nextGenerateAt: props.nextGenerateAt ?? null } : undefined,
  });

  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [spicyModeEnabled, setSpicyModeEnabled] = useState(() => props?.initialSpicyModeEnabled ?? false);
  const [spicyFilter, setSpicyFilter] = useState<"normal" | "spicy">("normal");
  const [selectedRefs, setSelectedRefs] = useState<StudioRef[]>([]);
  const hasImageRefs = selectedRefs.length > 0;
  const effectiveMode: "t2i" | "i2i" | "t2v" | "i2v" =
    mediaType === "video" ? (hasImageRefs ? "i2v" : "t2v") : (hasImageRefs ? "i2i" : "t2i");
  const catalog = useMemo(
    () => filterModels(models, effectiveMode, spicyFilter),
    [models, effectiveMode, spicyFilter],
  );
  const [jobs, setJobs] = useState<JobView[]>(() => props?.jobs ?? []);
  const [modelId, setModelId] = useState(() => pickInitialModel(catalog, effectiveMode, spicyFilter, props?.defaults));
  const [videoDuration, setVideoDuration] = useState<"6s" | "10s" | "15s">("6s");
  const [videoResolution, setVideoResolution] = useState<"480p" | "720p" | "1080p">("480p");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("3:2");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(props?.nextGenerateAt ?? null);
  const [libraryOpened, setLibraryOpened] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"generations" | "uploads">("generations");
  const [uploads, setUploads] = useState<StudioUpload[]>(() => props?.initialUploads ?? []);
  const [uploadPage, setUploadPage] = useState(1);
  const [uploadTotal, setUploadTotal] = useState(() => props?.initialUploadsTotal ?? props?.initialUploads?.length ?? 0);
  const [isUploadsLoading, setIsUploadsLoading] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [resultModalOpened, setResultModalOpened] = useState(false);
  const [uploadPolicyAccepted, setUploadPolicyAccepted] = useState(() => props?.initialUploadPolicyAccepted ?? false);
  const [uploadPolicyModalOpened, setUploadPolicyModalOpened] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const userCheckedRef = useRef(false);

  useEffect(() => {
    if (props?.models) setModels(props.models);
  }, [props?.models]);

  useEffect(() => {
    if (props?.defaults) setDefaults(props.defaults);
  }, [props?.defaults]);

  useEffect(() => {
    if (typeof props?.initialSpicyModeEnabled === "boolean") {
      setSpicyModeEnabled(props.initialSpicyModeEnabled);
    }
  }, [props?.initialSpicyModeEnabled]);

  useEffect(() => {
    if (typeof props?.initialUploadPolicyAccepted === "boolean") {
      setUploadPolicyAccepted(props.initialUploadPolicyAccepted);
    }
  }, [props?.initialUploadPolicyAccepted]);

  useEffect(() => {
    if (userStatusQuery.data) {
      userCheckedRef.current = true;
      setUploadPolicyAccepted(Boolean(userStatusQuery.data.uploadPolicyAcceptedAt));
      setSpicyModeEnabled(Boolean(userStatusQuery.data.spicyModeEnabled));
    }
  }, [userStatusQuery.data]);

  useEffect(() => {
    if (jobsQuery.data?.jobs) {
      setJobs(jobsQuery.data.jobs);
      const activeItem = jobsQuery.data.jobs.find((j) => isJobActive(j.status));
      if (activeItem) {
        setActiveJobId(activeItem.id);
        setActiveJob(activeItem);
      }
    }
    if (jobsQuery.data?.nextGenerateAt !== undefined) {
      setCooldownUntil(jobsQuery.data.nextGenerateAt);
    }
  }, [jobsQuery.data]);

  async function checkUserStatus() {
    if (userCheckedRef.current) return { accepted: uploadPolicyAccepted, spicyModeEnabled };
    if (userStatusQuery.data) {
      userCheckedRef.current = true;
      const accepted = Boolean(userStatusQuery.data.uploadPolicyAcceptedAt);
      const spicyEnabled = Boolean(userStatusQuery.data.spicyModeEnabled);
      setUploadPolicyAccepted(accepted);
      setSpicyModeEnabled(spicyEnabled);
      return {
        accepted,
        hasUploads: userStatusQuery.data.hasUploads,
        spicyModeEnabled: spicyEnabled,
      };
    }
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
    const spicyEnabled = Boolean(res.data.user.spicyModeEnabled);
    setUploadPolicyAccepted(accepted);
    setSpicyModeEnabled(spicyEnabled);
    return {
      accepted,
      hasUploads: res.data.user.hasUploads,
      spicyModeEnabled: spicyEnabled,
    };
  }
  const [lastGeneratedJob, setLastGeneratedJob] = useState<JobView | null>(null);
  const initialActive = (props?.jobs ?? []).find((j) => isJobActive(j.status));
  const [activeJobId, setActiveJobId] = useState<string | null>(() => urlJobId || initialActive?.id || null);
  const [activeJob, setActiveJob] = useState<JobView | null>(() => {
    if (urlJobId) {
      const found = (props?.jobs ?? []).find((j) => j.id === urlJobId);
      if (found) return found;
    }
    return initialActive ?? null;
  });

  useEffect(() => {
    if (urlJobId) {
      setActiveJobId(urlJobId);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("jobId");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      }
    }
  }, [urlJobId]);

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
  const gallery = jobs.filter((j) => j.status === "succeeded" && hasLiveOutput(j.output) && isJobImage(j));
  const cooldownLeft = remainingSeconds(cooldownUntil, now);
  const waiting = errorCode === "JOB_IN_PROGRESS" || errorCode === "COOLDOWN";
  const signedKey = jobs
    .filter((j) => hasLiveOutput(j.output) && j.output.signedExpiresAt)
    .map((j) => `${j.id}:${j.output?.signedExpiresAt ?? ""}`)
    .join("|");
  const aspectMeta = STUDIO_ASPECTS.find((item) => item.value === aspectRatio) ?? STUDIO_ASPECTS[1];

  useEffect(() => {
    if (props?.initialUploads && props.initialUploads.length > 0) {
      setUploads(props.initialUploads);
    }
    if (typeof props?.initialUploadsTotal === "number") {
      setUploadTotal(props.initialUploadsTotal);
    }
  }, [props?.initialUploads, props?.initialUploadsTotal]);

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
      const loaded: StudioUpload[] = res.data.items.map((item) => {
        const cleanName = (item.alias || item.key.split("/").pop() || item.id).replace(/\.[^/.]+$/, "");
        return {
          id: item.id,
          url: resolveUploadUrl(item.url, item.id),
          name: cleanName,
          key: item.key,
          alias: item.alias ? item.alias.replace(/\.[^/.]+$/, "") : cleanName,
          width: item.width,
          height: item.height,
        };
      });
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
      const key = `${videoDuration}_${videoResolution}`;
      if (selected?.videoConfigPoints && typeof selected.videoConfigPoints[key] === "number") {
        return Number(selected.videoConfigPoints[key]);
      }
      const DEFAULT_VIDEO_PRICING: Record<string, number> = {
        "6s_480p": 100,
        "6s_720p": 210,
        "6s_1080p": 500,
        "10s_480p": 155,
        "10s_720p": 345,
        "10s_1080p": 820,
        "15s_480p": 235,
        "15s_720p": 510,
        "15s_1080p": 1230,
      };
      if (typeof DEFAULT_VIDEO_PRICING[key] === "number") {
        return DEFAULT_VIDEO_PRICING[key];
      }
      return selected?.costPoints ?? 100;
    }
    return selected?.costPoints ?? 10;
  }, [mediaType, videoDuration, videoResolution, selected]);

  const isUploadingRefs = selectedRefs.some((r) => r.uploading);
  const canSend =
    prompt.trim().length > 0 &&
    Boolean(selected) &&
    !busy &&
    !isGenerating &&
    !isUploadingRefs &&
    cooldownLeft <= 0;

  useEffect(() => {
    if (props?.jobs) {
      setJobs(props.jobs);
      const activeItem = props.jobs.find((j) => isJobActive(j.status));
      if (activeItem) {
        setActiveJobId(activeItem.id);
        setActiveJob(activeItem);
      }
    }
    if (props?.nextGenerateAt !== undefined) {
      setCooldownUntil(props.nextGenerateAt);
    }
  }, [props?.jobs, props?.nextGenerateAt]);

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
    if (!cooldownUntil) return;
    const initialLeft = remainingSeconds(cooldownUntil, Date.now());
    if (initialLeft <= 0) return;

    setNow(Date.now());
    const tick = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (remainingSeconds(cooldownUntil, current) <= 0) {
        window.clearInterval(tick);
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [cooldownUntil]);

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
        void queryClient.invalidateQueries({ queryKey: queryKeys.generatedJobs() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.library() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
      } else if (data.status === "failed" || data.status === "canceled") {
        setError(jobErrorMessage(data.errorCode, data.errorMessage));
        setErrorCode(data.errorCode ?? "JOB_FAILED");
        setActiveJobId(null);
        setActiveJob(null);
        setJobs((prev) => [data, ...prev.filter((j) => j.id !== data.id)]);
        void queryClient.invalidateQueries({ queryKey: queryKeys.generatedJobs() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
      }
    }

    // Fetch current job state immediately (initial snapshot)
    void checkJobFallback();

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
        isSpicy: spicyFilter === "spicy",
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
    uploadFileWithProgress(file, {
      onProgress: (pct) => {
        setUploads((prev) =>
          prev.map((item) => (item.id === tempId ? { ...item, progress: pct } : item))
        );
        setSelectedRefs((prev) =>
          prev.map((item) => (item.id === tempId ? { ...item, progress: pct } : item))
        );
      },
      onSuccess: (result) => {
        const cleanName = (result.alias || file.name).replace(/\.[^/.]+$/, "");
        setUploads((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  id: result.id,
                  url: result.url,
                  name: cleanName,
                  alias: cleanName,
                  uploading: false,
                  progress: 100,
                  width: result.width,
                  height: result.height,
                }
              : item
          )
        );
        setSelectedRefs((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  id: result.id,
                  url: result.url,
                  name: cleanName,
                  alias: cleanName,
                  uploading: false,
                  progress: 100,
                  format: "WEBP",
                  width: result.width,
                  height: result.height,
                }
              : item
          )
        );
      },
      onError: (msg) => {
        handleUploadError(tempId, msg);
      },
    });
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

  const MAX_STUDIO_REFS = 5;

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (!uploadPolicyAccepted) {
      setUploadPolicyModalOpened(true);
      return;
    }

    const availableSlots = MAX_STUDIO_REFS - selectedRefs.length;
    if (availableSlots <= 0) {
      setError("Maksimal hanya 5 gambar referensi yang dapat dipilih.");
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      setError("Maksimal hanya 5 gambar referensi yang dapat dipilih.");
    }

    const newUploads: StudioUpload[] = [];
    const newRefs: StudioRef[] = [];

    for (const file of filesToUpload) {
      const tempId = `up-${crypto.randomUUID()}`;
      const localBlobUrl = URL.createObjectURL(file);
      const ext = file.name.split(".").pop()?.toUpperCase() ?? file.type.split("/")[1]?.toUpperCase() ?? "IMAGE";
      const cleanName = file.name.replace(/\.[^/.]+$/, "");

      const newRef: StudioRef = {
        id: tempId,
        url: localBlobUrl,
        kind: "upload",
        uploading: true,
        progress: 0,
        name: cleanName,
        alias: cleanName,
        format: ext,
        contentType: file.type,
      };

      newRefs.push(newRef);

      newUploads.push({
        id: tempId,
        url: localBlobUrl,
        name: cleanName,
        alias: cleanName,
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
      if (prev.length >= MAX_STUDIO_REFS) {
        setError("Maksimal hanya 5 gambar referensi yang dapat dipilih.");
        return prev;
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
    const displayName = (item.alias || item.name).replace(/\.[^/.]+$/, "");
    const ext = "WEBP";
    setSelectedRefs((prev) => {
      if (prev.some((ref) => ref.id === item.id)) {
        return prev.filter((ref) => ref.id !== item.id);
      }
      if (prev.length >= MAX_STUDIO_REFS) {
        setError("Maksimal hanya 5 gambar referensi yang dapat dipilih.");
        return prev;
      }
      return resequenceRefs([
        ...prev,
        {
          id: item.id,
          url: item.url,
          kind: "upload",
          uploading: item.uploading,
          progress: item.progress,
          alias: displayName,
          name: displayName,
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
    available: wallet.available,
    held: wallet.held,
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
