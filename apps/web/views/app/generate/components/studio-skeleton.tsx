"use client";

import { Skeleton } from "@mantine/core";
import classes from "./generate-studio.module.css";

export function StudioSkeleton() {
  return (
    <div className={classes.page}>
      <div className={classes.stage}>
        <Skeleton height={280} width="60%" maw={400} radius="lg" />
      </div>
      <div className={classes.dock}>
        <Skeleton height={52} radius="xl" />
      </div>
    </div>
  );
}
