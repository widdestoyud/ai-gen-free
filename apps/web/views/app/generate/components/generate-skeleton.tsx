"use client";

import { Group, Progress, Skeleton, Text } from "@mantine/core";
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
    <div className={classes.skeletonCard}>
      <div className={`${classes.skeletonBox} ${aspectClass}`}>
        <Skeleton height="100%" width="100%" radius="md" animate={true} />
        <div className={classes.skeletonOverlay}>
          <SparkleIcon size={24} className={classes.sparkleSpin} />
          <Text size="sm" fw={600} c="dimmed">
            {mediaType === "video" ? "Merender video..." : "Merender gambar..."}
          </Text>
        </div>
      </div>
      <div className={classes.progressWrapper}>
        <Group justify="space-between" mb={4}>
          <Text size="xs" fw={600} c="dimmed">
            {mediaType === "video" ? "Proses Render Video" : "Proses Render Gambar"}
          </Text>
          <Text size="xs" fw={700} c="lime.4">
            {Math.round(progressVal)}%
          </Text>
        </Group>
        <Progress
          value={progressVal}
          animated
          striped
          size="sm"
          radius="xl"
          color="lime"
        />
        <Text size="xs" c="dimmed" mt={6} ta="center">
          Tab lain tidak bisa submit paralel saat proses berlangsung.
        </Text>
      </div>
    </div>
  );
}
