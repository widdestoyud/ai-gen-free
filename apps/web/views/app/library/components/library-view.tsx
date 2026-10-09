"use client";

import { useState } from "react";
import {
  ActionIcon,
  Button,
  Menu,
  Progress,
  Skeleton,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { useLibrary, type LibraryItem, type LibraryTab, isUpscaledImage } from "@/hooks/use-library";
import { formatBytes, formatRelativeTime, resolveUploadUrl } from "@/lib/format";
import {
  CheckIcon,
  CloseIcon,
  FilterSlidersIcon,
  MediaStackIcon,
  SearchIcon,
  VideoIcon,
} from "./library-icons";
import { MediaDetailModal } from "./media-detail-modal";
import { InpaintEditorModal } from "./inpaint/inpaint-editor-modal";
import { UploadPolicyModal } from "@/components/upload-policy-modal";
import classes from "./library-view.module.css";

const TABS: Array<{ label: string; value: LibraryTab }> = [
  { label: "All", value: "all" },
  { label: "Generations", value: "generations" },
  { label: "Uploaded media", value: "uploads" },
];

function getMediaTitle(item: LibraryItem): string {
  if (item.alias) return item.alias.replace(/\.[^/.]+$/, "");
  if (isUpscaledImage(item)) return "Upscaled Image";
  if (item.prompt) {
    return item.kind === "video"
      ? `${item.prompt.slice(0, 32)}.mp4`
      : item.prompt;
  }
  return item.kind === "video" ? "uploaded_video" : "uploaded_image";
}

export function LibraryView(props?: {
  initialItems?: LibraryItem[];
  initialTotal?: number;
}) {
  const ctrl = useLibrary(props);
  const [inpaintItem, setInpaintItem] = useState<LibraryItem | null>(null);

  return (
    <div className={classes.container}>
      {/* Top Bar: Tabs, Search, Filter Menu, Upload Button */}
      <div className={classes.topBar}>
        <div className={classes.tabsRow}>
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`${classes.tabBtn} ${ctrl.tab === t.value ? classes.tabBtnActive : ""}`}
              onClick={() => ctrl.setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={classes.actionsRow}>
          <div className={classes.searchFilterGroup}>
            <TextInput
              placeholder="Search"
              value={ctrl.search}
              onChange={(e) => ctrl.setSearch(e.currentTarget.value)}
              leftSection={<SearchIcon size={15} />}
              rightSection={
                ctrl.search ? (
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    onClick={() => ctrl.setSearch("")}
                    aria-label="Bersihkan pencarian"
                  >
                    <CloseIcon size={12} />
                  </ActionIcon>
                ) : null
              }
              className={classes.searchInput}
            />

            {/* Filter & Sort Dropdown Menu */}
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <button
                  type="button"
                  className={classes.iconBtn}
                  aria-label="Opsi Tampilan dan Urutan"
                >
                  <FilterSlidersIcon size={16} />
                </button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>View</Menu.Label>
                <Menu.Item
                  onClick={() => ctrl.setViewMode("grid")}
                  rightSection={ctrl.viewMode === "grid" ? <CheckIcon size={13} /> : null}
                >
                  Grid
                </Menu.Item>
                <Menu.Item
                  onClick={() => ctrl.setViewMode("list")}
                  rightSection={ctrl.viewMode === "list" ? <CheckIcon size={13} /> : null}
                >
                  List
                </Menu.Item>

                <Menu.Divider />

                <Menu.Label>Sort by</Menu.Label>
                <Menu.Item
                  onClick={() => ctrl.setSortBy("date")}
                  rightSection={ctrl.sortBy === "date" ? <CheckIcon size={13} /> : null}
                >
                  Date created
                </Menu.Item>
                <Menu.Item
                  onClick={() => ctrl.setSortBy("name")}
                  rightSection={ctrl.sortBy === "name" ? <CheckIcon size={13} /> : null}
                >
                  Name
                </Menu.Item>
                <Menu.Item
                  onClick={() => ctrl.setSortBy("size")}
                  rightSection={ctrl.sortBy === "size" ? <CheckIcon size={13} /> : null}
                >
                  File size
                </Menu.Item>

                <Menu.Divider />

                <Menu.Label>Order</Menu.Label>
                <Menu.Item
                  onClick={() => ctrl.setSortOrder("newest")}
                  rightSection={ctrl.sortOrder === "newest" ? <CheckIcon size={13} /> : null}
                >
                  Newest
                </Menu.Item>
                <Menu.Item
                  onClick={() => ctrl.setSortOrder("oldest")}
                  rightSection={ctrl.sortOrder === "oldest" ? <CheckIcon size={13} /> : null}
                >
                  Oldest
                </Menu.Item>

                <Menu.Divider />

                <Menu.Label>Show Only</Menu.Label>
                <Menu.Item
                  onClick={() => ctrl.setShowOnly("all")}
                  rightSection={ctrl.showOnly === "all" ? <CheckIcon size={13} /> : null}
                >
                  All
                </Menu.Item>
                <Menu.Item
                  onClick={() => ctrl.setShowOnly("images")}
                  rightSection={ctrl.showOnly === "images" ? <CheckIcon size={13} /> : null}
                >
                  Images
                </Menu.Item>
                <Menu.Item
                  onClick={() => ctrl.setShowOnly("videos")}
                  rightSection={ctrl.showOnly === "videos" ? <CheckIcon size={13} /> : null}
                >
                  Videos
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>

          <button
            type="button"
            className={classes.uploadBtn}
            onClick={ctrl.openFilePicker}
            disabled={ctrl.isUploading}
          >
            {ctrl.isUploading ? "Uploading..." : "Upload files"}
          </button>

          <input
            ref={ctrl.fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className={classes.hiddenInput}
            onChange={(e) => void ctrl.handleFileInputChange(e)}
          />
        </div>
      </div>

      {ctrl.isLoading ? (
        <div className={classes.grid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={classes.cardWrapper}>
              <div className={classes.mediaThumbBox}>
                <Skeleton height="100%" radius="sm" />
              </div>
              <div className={classes.cardMeta}>
                <Skeleton height={14} width="75%" radius="xs" mt={4} />
                <Skeleton height={11} width="45%" radius="xs" mt={6} />
              </div>
            </div>
          ))}
        </div>
      ) : ctrl.items.length === 0 && ctrl.inFlightUploads.length === 0 ? (
        <EmptyState minHeight={320}>
          <Stack align="center" gap="xs">
            <Text c="dimmed">
              {ctrl.search
                ? `Tidak ada media yang cocok dengan kata kunci "${ctrl.search}".`
                : ctrl.tab === "uploads"
                  ? "Belum ada berkas media yang diunggah."
                  : "Belum ada media hasil generate."}
            </Text>
            {ctrl.tab !== "uploads" && (
              <Button component={Link} href="/app/generate" prefetch={false} variant="light" size="xs">
                Mulai Generate
              </Button>
            )}
          </Stack>
        </EmptyState>
      ) : ctrl.viewMode === "grid" ? (
        /* Flat Grid View with in-flight uploads and items */
        <div className={classes.grid}>
          {ctrl.inFlightUploads.map((upload) => (
            <div key={upload.id} className={classes.cardWrapper} style={{ cursor: "default" }}>
              <div className={classes.mediaThumbBox}>
                {upload.file.type.startsWith("video/") ? (
                  <video
                    src={upload.url}
                    className={`${classes.video} ${classes.tileBlur}`}
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={upload.url}
                    alt={upload.name}
                    className={`${classes.image} ${classes.tileBlur}`}
                  />
                )}
                <div className={classes.tileProgressOverlay}>
                  <Progress
                    value={upload.progress}
                    size="sm"
                    radius="xl"
                    color="blue"
                    animated
                    className={classes.tileProgressBar}
                  />
                  <span className={classes.tileProgressText}>{upload.progress}%</span>
                </div>
              </div>
              <div className={classes.cardMeta}>
                <div className={classes.cardTitle} title={upload.name}>
                  {upload.name}
                </div>
                <div className={classes.cardSub}>
                  Mengunggah... · {formatBytes(upload.file.size)}
                </div>
              </div>
            </div>
          ))}

          {ctrl.items.map((item) => {
            const isVideo =
              item.kind === "video" || item.mime_type.startsWith("video/");
            const timeStr = formatRelativeTime(item.created_at);
            const sizeStr = formatBytes(item.size_bytes);
            const title = getMediaTitle(item);

            return (
              <div
                key={item.id}
                className={classes.cardWrapper}
                onClick={() => ctrl.openPreview(item)}
                role="button"
                tabIndex={0}
              >
                <div className={classes.mediaThumbBox}>
                  {isVideo ? (
                    <video
                      src={resolveUploadUrl(item.url)}
                      className={classes.video}
                      muted
                      playsInline
                      loop
                      onMouseOver={(e) => void e.currentTarget.play().catch(() => {})}
                      onMouseOut={(e) => e.currentTarget.pause()}
                    />
                  ) : (
                    <img
                      src={resolveUploadUrl(item.url)}
                      alt={item.prompt || item.alias || title}
                      loading="lazy"
                      className={classes.image}
                    />
                  )}
                  <div className={classes.overlayIcon}>
                    {isVideo ? <VideoIcon /> : <MediaStackIcon />}
                  </div>
                </div>

                <div className={classes.cardMeta}>
                  <div className={classes.cardTitle} title={item.prompt || title}>
                    {title}
                  </div>
                  <div className={classes.cardSub} suppressHydrationWarning>
                    {timeStr}
                    {sizeStr ? ` · ${sizeStr}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View with in-flight uploads and items */
        <div className={classes.listContainer}>
          {ctrl.inFlightUploads.map((upload) => (
            <div key={upload.id} className={classes.listRow} style={{ cursor: "default" }}>
              <div className={classes.listLeft}>
                <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
                  {upload.file.type.startsWith("video/") ? (
                    <video
                      src={upload.url}
                      className={`${classes.listThumb} ${classes.tileBlur}`}
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={upload.url}
                      alt={upload.name}
                      className={`${classes.listThumb} ${classes.tileBlur}`}
                    />
                  )}
                </div>
                <Stack gap={2} className={classes.listTextCol} style={{ flex: 1, minWidth: 0 }}>
                  <div className={classes.listTitle}>{upload.name}</div>
                  <div style={{ width: "100%", maxWidth: 200, marginTop: 4 }}>
                    <Progress
                      value={upload.progress}
                      size="xs"
                      radius="xl"
                      color="blue"
                      animated
                    />
                  </div>
                </Stack>
              </div>

              <div className={classes.listRight}>
                <span>{upload.progress}%</span>
                <span>{formatBytes(upload.file.size)}</span>
              </div>
            </div>
          ))}

          {ctrl.items.map((item) => {
            const isVideo =
              item.kind === "video" || item.mime_type.startsWith("video/");
            const timeStr = formatRelativeTime(item.created_at);
            const sizeStr = formatBytes(item.size_bytes);
            const title = getMediaTitle(item);

            return (
              <UnstyledButton
                key={item.id}
                className={classes.listRow}
                onClick={() => ctrl.openPreview(item)}
              >
                <div className={classes.listLeft}>
                  {isVideo ? (
                    <video
                      src={resolveUploadUrl(item.url)}
                      className={classes.listThumb}
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={resolveUploadUrl(item.url)}
                      alt={item.prompt || item.alias || title}
                      loading="lazy"
                      className={classes.listThumb}
                    />
                  )}
                  <Stack gap={2} className={classes.listTextCol}>
                    <div className={classes.listTitle}>{title}</div>
                    <div className={classes.listSub}>{item.prompt || item.alias || item.id}</div>
                  </Stack>
                </div>

                <div className={classes.listRight}>
                  {sizeStr ? <span>{sizeStr}</span> : null}
                  <span suppressHydrationWarning>{timeStr}</span>
                </div>
              </UnstyledButton>
            );
          })}
        </div>
      )}

      <MediaDetailModal
        opened={ctrl.previewOpened}
        onClose={ctrl.closePreview}
        item={ctrl.selectedItem}
        items={ctrl.items}
        onSelectItem={ctrl.openPreview}
        onDeleteUpload={ctrl.deleteUpload}
        onUpscaleSuccess={() => void ctrl.refreshLibrary()}
        onOpenInpaint={(item) => setInpaintItem(item)}
      />

      <InpaintEditorModal
        opened={!!inpaintItem}
        onClose={() => setInpaintItem(null)}
        item={inpaintItem}
        onSuccess={() => {
          setInpaintItem(null);
          void ctrl.refreshLibrary();
        }}
      />

      <UploadPolicyModal
        opened={ctrl.uploadPolicyModalOpened}
        onClose={() => ctrl.setUploadPolicyModalOpened(false)}
        onAccept={ctrl.acceptUploadPolicy}
        loading={ctrl.policySaving}
        error={ctrl.policyError}
      />
    </div>
  );
}
