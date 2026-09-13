"use client";

import { Skeleton, Text } from "@mantine/core";
import { useEffect, useState } from "react";
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
  const [fakeProgress, setFakeProgress] = useState(15);

  useEffect(() => {
    if (typeof progress === "number" && progress > 0) return;
    const interval = window.setInterval(() => {
      setFakeProgress((prev) => {
        if (prev >= 90) return prev;
        const jump = Math.floor(Math.random() * 8) + 4;
        return Math.min(prev + jump, 90);
      });
    }, 1200);
    return () => window.clearInterval(interval);
  }, [progress]);

  const progressVal = typeof progress === "number" && progress > 0 ? progress : fakeProgress;
  const aspectClass = ASPECT_CLASS[aspectRatio] ?? classes.skeletonAspect_3_2;

  return (
    <div className={`${classes.skeletonBox} ${aspectClass}`}>
      <Skeleton height="100%" width="100%" radius="lg" animate={true} />
      <div className={classes.skeletonOverlay}>
        <div className={classes.rainbowSparkle}>
          <SparkleIcon size={34} />
        </div>
        <Text size="sm" fw={500} className={classes.generatingText}>
          Generating... {Math.round(progressVal)}%
        </Text>
      </div>
    </div>
  );
}
