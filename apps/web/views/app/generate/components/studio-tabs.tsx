"use client";

import { useI18n } from "@/lib/i18n";
import classes from "./studio-tabs.module.css";

export type StudioTabValue = "tasks" | "templates";

export interface StudioTabsProps {
  value: StudioTabValue;
  onChange: (value: StudioTabValue) => void;
  activeJobCount: number;
}

export function StudioTabs({ value, onChange, activeJobCount }: StudioTabsProps) {
  const { t } = useI18n("generate");

  return (
    <div className={classes.tabList} role="tablist" aria-label={t("title")}>
      <button
        type="button"
        role="tab"
        id="studio-tab-tasks"
        aria-selected={value === "tasks"}
        aria-controls="studio-panel-tasks"
        className={`${classes.tabButton} ${value === "tasks" ? classes.tabButtonActive : ""}`}
        onClick={() => onChange("tasks")}
      >
        <span>{t("tabs.tasks")}</span>
        {activeJobCount > 0 ? (
          <span className={classes.activeBadge} aria-label={`${activeJobCount}`}>
            {activeJobCount}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        role="tab"
        id="studio-tab-templates"
        aria-selected={value === "templates"}
        aria-controls="studio-panel-templates"
        className={`${classes.tabButton} ${value === "templates" ? classes.tabButtonActive : ""}`}
        onClick={() => onChange("templates")}
      >
        <span>{t("tabs.templates")}</span>
      </button>
    </div>
  );
}
