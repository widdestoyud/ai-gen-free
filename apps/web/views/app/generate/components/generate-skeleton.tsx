"use client";

import { Progress, Skeleton, Text } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { getProgressMessage, getProgressStageKey } from "@/lib/progress-messages";
import { SparkleIcon } from "./generate-icons";
import classes from "./generate-studio.module.css";

const ASPECT_CLASS: Record<string, string> = {
  "1:1": classes.skeletonAspect_1_1,
  "3:2": classes.skeletonAspect_3_2,
  "2:3": classes.skeletonAspect_2_3,
  "16:9": classes.skeletonAspect_16_9,
  "9:16": classes.skeletonAspect_9_16,
};

export function GenerateSkeleton({
  aspectRatio,
  progress,
  mediaType = "image",
}: {
  aspectRatio: string;
  progress?: number;
  mediaType?: "image" | "video";
}) {
  const [fakeProgress, setFakeProgress] = useState(12);
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * 20));
  const [isFading, setIsFading] = useState(false);
  const prevStageRef = useRef<string>("10");

  // Simulate smooth initial progress if real progress not yet received
  useEffect(() => {
    if (typeof progress === "number" && progress > 0) return;
    const interval = window.setInterval(() => {
      setFakeProgress((prev) => {
        if (prev >= 88) return prev;
        const jump = Math.floor(Math.random() * 6) + 3;
        return Math.min(prev + jump, 88);
      });
    }, 1400);
    return () => window.clearInterval(interval);
  }, [progress]);

  const progressVal = typeof progress === "number" && progress > 0 ? progress : fakeProgress;
  const currentStage = getProgressStageKey(progressVal);

  // When stage changes, smoothly refresh message index
  useEffect(() => {
    if (prevStageRef.current !== currentStage) {
      prevStageRef.current = currentStage;
      setIsFading(true);
      const timer = window.setTimeout(() => {
        setMsgIndex(Math.floor(Math.random() * 20));
        setIsFading(false);
      }, 200);
      return () => window.clearTimeout(timer);
    }
  }, [currentStage]);

  // Periodic smooth message rotation every 3.8s within the current stage
  useEffect(() => {
    const interval = window.setInterval(() => {
      setIsFading(true);
      window.setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % 20);
        setIsFading(false);
      }, 220);
    }, 3800);
    return () => window.clearInterval(interval);
  }, []);

  const activeMessage = getProgressMessage(progressVal, msgIndex);
  const aspectClass = ASPECT_CLASS[aspectRatio] ?? classes.skeletonAspect_3_2;

  return (
    <div className={`${classes.skeletonBox} ${aspectClass}`}>
      <Skeleton height="100%" width="100%" radius="lg" animate={true} />
      <div className={classes.skeletonOverlay}>
        <div className={classes.rainbowSparkle}>
          <SparkleIcon size={34} />
        </div>

        <div className={classes.skeletonProgressContainer}>
          <div className={classes.skeletonProgressPill}>
            <span>{mediaType === "video" ? "🎬 Merender Video" : "🎨 Memproses Kreasi"}</span>
            <span>·</span>
            <span>{Math.round(progressVal)}%</span>
          </div>

          <Progress
            value={Math.round(progressVal)}
            animated
            size="sm"
            radius="xl"
            color="violet"
            className={classes.skeletonProgressBar}
          />

          <div
            className={`${classes.skeletonDynamicMessage} ${
              isFading ? classes.skeletonMessageFadeOut : classes.skeletonMessageFadeIn
            }`}
          >
            <Text size="sm" ta="center">
              {activeMessage}
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}

