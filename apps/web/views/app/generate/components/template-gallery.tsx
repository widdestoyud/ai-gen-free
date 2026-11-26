"use client";

import { useState } from "react";
import { ActionIcon, Alert, Button, Group, Skeleton, Switch, Text, TextInput } from "@mantine/core";
import { AppLink } from "@/components/app-link";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import type { TemplateSort } from "@/hooks/use-template-gallery";
import { useI18n } from "@/lib/i18n";
import type { CustomerTemplate } from "@/lib/template-apply";
import { CloseIcon, SearchIcon } from "./generate-icons";
import { TemplateCard } from "./template-card";
import classes from "./template-gallery.module.css";

export interface TemplateGalleryProps {
  items: CustomerTemplate[];
  categories: string[];
  query: string;
  onQueryChange: (q: string) => void;
  category: string | null;
  onCategoryChange: (cat: string | null) => void;
  sort: TemplateSort;
  onSortChange: (sort: TemplateSort) => void;
  adultOn: boolean;
  onAdultToggle: (next: boolean) => void;
  adultDisabled?: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string | null;
  onRetry: () => void;
  onTryTemplate: (template: CustomerTemplate) => void;
  sentinelRef: (node: HTMLDivElement | null) => void;
  scrollRootRef?: (node: HTMLDivElement | null) => void;
  spicyHint?: string | null;
  onDismissSpicyHint?: () => void;
}

const INITIAL_SKELETON_COUNT = 12;
const NEXT_PAGE_SKELETON_COUNT = 4;

export function TemplateGallery({
  items,
  categories,
  query,
  onQueryChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  adultOn,
  onAdultToggle,
  adultDisabled = false,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onTryTemplate,
  sentinelRef,
  scrollRootRef,
  spicyHint,
  onDismissSpicyHint,
}: TemplateGalleryProps) {
  const { t } = useI18n("generate");
  const { t: tCommon } = useI18n("common");
  const [revealedId, setRevealedId] = useState<string>("");

  const sortOptions: Array<{ value: TemplateSort; label: string }> = [
    { value: "default", label: t("templates.sort_all") },
    { value: "trending", label: t("templates.sort_trending") },
    { value: "newest", label: t("templates.sort_newest") },
  ];

  return (
    <div
      ref={scrollRootRef}
      id="studio-panel-templates"
      role="tabpanel"
      aria-labelledby="studio-tab-templates"
      className={classes.scrollContainer}
    >
      <div className={classes.stickyHeader}>
        <div className={classes.controlsRow}>
          <div
            className={`${classes.adultSwitchPill} ${adultOn ? classes.adultSwitchPillActive : ""}`}
          >
            <Switch
              checked={adultOn}
              onChange={(e) => onAdultToggle(e.currentTarget.checked)}
              disabled={adultDisabled}
              label={t("templates.adult_toggle")}
              size="sm"
              color="red"
              classNames={{ label: classes.adultSwitchLabel }}
              aria-label={t("templates.adult_toggle")}
            />
          </div>

          <TextInput
            value={query}
            onChange={(e) => onQueryChange(e.currentTarget.value)}
            placeholder={t("templates.search_placeholder")}
            aria-label={t("templates.search_placeholder")}
            size="sm"
            radius="xl"
            leftSection={<SearchIcon size={15} />}
            rightSection={
              query.length > 0 ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  radius="xl"
                  onClick={() => onQueryChange("")}
                  aria-label={tCommon("close")}
                >
                  <CloseIcon size={12} />
                </ActionIcon>
              ) : null
            }
            className={classes.searchInput}
            classNames={{ input: classes.searchField }}
          />

          <div
            className={classes.sortPillGroup}
            role="radiogroup"
            aria-label={t("templates.sort_all")}
          >
            {sortOptions.map((opt) => {
              const active = sort === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`${classes.sortPill} ${active ? classes.sortPillActive : ""}`}
                  onClick={() => onSortChange(opt.value)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {categories.length > 0 ? (
          <div className={classes.categoryRow} role="group" aria-label={t("templates.sort_all")}>
            <button
              type="button"
              className={`${classes.categoryPill} ${category === null ? classes.categoryPillActive : ""}`}
              onClick={() => onCategoryChange(null)}
            >
              {t("templates.sort_all")}
            </button>
            {categories.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  className={`${classes.categoryPill} ${active ? classes.categoryPillActive : ""}`}
                  onClick={() => onCategoryChange(active ? null : cat)}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        ) : null}

        {spicyHint ? (
          <Alert
            color="red"
            variant="light"
            radius="md"
            withCloseButton
            onClose={onDismissSpicyHint}
            className={classes.spicyHintAlert}
          >
            <Group gap="xs" align="center" wrap="wrap">
              <Text size="xs">{spicyHint}</Text>
              <AppLink href="/app/profile">{t("templates.spicy_profile_link")}</AppLink>
            </Group>
          </Alert>
        ) : null}
      </div>

      <div className={classes.gridSection}>
        {isLoading ? (
          <div className={classes.grid} aria-busy="true" aria-label={tCommon("loading")}>
            {Array.from({ length: INITIAL_SKELETON_COUNT }).map((_, idx) => (
              <Skeleton key={idx} radius={12} className={classes.skeletonCard} />
            ))}
          </div>
        ) : isError && items.length === 0 ? (
          <div className={classes.statusArea}>
            <ErrorAlert message={errorMessage || t("templates.load_error")} />
            <Button variant="default" size="sm" radius="xl" onClick={onRetry}>
              {t("templates.retry")}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState>{t("templates.empty")}</EmptyState>
        ) : (
          <>
            <div className={classes.grid}>
              {items.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  revealed={revealedId === tpl.id}
                  onReveal={setRevealedId}
                  onTry={(selected) => {
                    setRevealedId("");
                    onTryTemplate(selected);
                  }}
                  tryLabel={t("templates.try")}
                />
              ))}

              {isFetchingNextPage
                ? Array.from({ length: NEXT_PAGE_SKELETON_COUNT }).map((_, idx) => (
                    <Skeleton
                      key={`next-skeleton-${idx}`}
                      radius={12}
                      className={classes.skeletonCard}
                    />
                  ))
                : null}
            </div>

            {isError ? (
              <div className={classes.statusArea}>
                <ErrorAlert message={errorMessage || t("templates.load_error")} />
                <Button variant="default" size="sm" radius="xl" onClick={onRetry}>
                  {t("templates.retry")}
                </Button>
              </div>
            ) : null}

            {!hasNextPage && !isFetchingNextPage ? (
              <p className={classes.endText}>{t("templates.end")}</p>
            ) : null}

            <div ref={sentinelRef} className={classes.sentinel} aria-hidden="true" />
          </>
        )}
      </div>
    </div>
  );
}
