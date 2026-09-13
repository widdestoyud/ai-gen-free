"use client";

import { useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api";
import {
  hasLiveOutput,
  isJobActive,
  signedRefreshDelayMs,
  type JobsListView,
  type JobView,
} from "@/lib/job-status";

export type MediaFilter = "all" | "images" | "videos";

function nearestSignedRefresh(jobs: JobView[]): number | null {
  let best: number | null = null;
  for (const job of jobs) {
    const delay = signedRefreshDelayMs(job.output);
    if (delay == null) continue;
    if (best == null || delay < best) best = delay;
  }
  return best;
}

export function useLibrary(props: {
  initialJobs: JobView[];
  nextGenerateAt?: string | null;
}) {
  const [jobs, setJobs] = useState<JobView[]>(props.initialJobs);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [selectedJob, setSelectedJob] = useState<JobView | null>(null);
  const [previewOpened, setPreviewOpened] = useState(false);

  const active = jobs.find((j) => isJobActive(j.status));
  const succeededJobs = useMemo(
    () => jobs.filter((j) => j.status === "succeeded" && hasLiveOutput(j.output)),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    if (filter === "images") {
      return succeededJobs.filter(
        (j) => !j.mode?.includes("video") && !j.output?.contentType.startsWith("video/"),
      );
    }
    if (filter === "videos") {
      return succeededJobs.filter(
        (j) => j.mode?.includes("video") || j.output?.contentType.startsWith("video/"),
      );
    }
    return succeededJobs;
  }, [succeededJobs, filter]);

  const counts = useMemo(() => {
    const images = succeededJobs.filter(
      (j) => !j.mode?.includes("video") && !j.output?.contentType.startsWith("video/"),
    ).length;
    const videos = succeededJobs.filter(
      (j) => j.mode?.includes("video") || j.output?.contentType.startsWith("video/"),
    ).length;
    return {
      all: succeededJobs.length,
      images,
      videos,
    };
  }, [succeededJobs]);

  useEffect(() => {
    setJobs(props.initialJobs);
  }, [props.initialJobs]);

  async function refreshLibrary() {
    const result = await requestJson<JobsListView>("/api/library");
    if (!result.ok) return;
    setJobs(result.data.jobs);
  }

  // Polling when active jobs are being rendered
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        const result = await requestJson<JobsListView>("/api/library");
        if (cancelled || !result.ok) return;
        setJobs(result.data.jobs);
      })();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active]);

  // Signed URL auto-refresh
  const signedKey = jobs
    .filter((j) => hasLiveOutput(j.output) && j.output.signedExpiresAt)
    .map((j) => `${j.id}:${j.output?.signedExpiresAt ?? ""}`)
    .join("|");

  useEffect(() => {
    if (active) return;
    const delay = nearestSignedRefresh(jobs);
    if (delay == null) return;
    const timer = window.setTimeout(() => {
      void refreshLibrary();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [active, signedKey]);

  function openPreview(job: JobView) {
    setSelectedJob(job);
    setPreviewOpened(true);
  }

  function closePreview() {
    setPreviewOpened(false);
    setSelectedJob(null);
  }

  return {
    jobs,
    succeededJobs,
    filteredJobs,
    filter,
    setFilter,
    counts,
    active,
    selectedJob,
    previewOpened,
    openPreview,
    closePreview,
    refreshLibrary,
  };
}
