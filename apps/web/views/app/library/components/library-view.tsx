"use client";

import {
  ActionIcon,
  Button,
  Menu,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { useLibrary, type LibraryItem, type LibraryTab } from "@/hooks/use-library";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import {
  CheckIcon,
  CloseIcon,
  FilterSlidersIcon,
  MediaStackIcon,
  SearchIcon,
  VideoIcon,
} from "./library-icons";
import { MediaDetailModal } from "./media-detail-modal";
import classes from "./library-view.module.css";

const TABS: Array<{ label: string; value: LibraryTab }> = [
  { label: "All", value: "all" },
  { label: "Generations", value: "generations" },
  { label: "Uploaded media", value: "uploads" },
];

function getMediaTitle(item: LibraryItem): string {
  if (item.alias) return item.alias;
  if (item.prompt) {
    return item.kind === "video"
      ? `${item.prompt.slice(0, 32)}.mp4`
      : item.prompt;
  }
  return item.kind === "video" ? "uploaded_video.mp4" : "uploaded_image.webp";
}

export function LibraryView(props: {
  initialItems?: LibraryItem[];
  initialTotal?: number;
}) {
  const ctrl = useLibrary(props);

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

      {ctrl.items.length === 0 ? (
        <EmptyState minHeight={320}>
          <Stack align="center" gap="xs">
            <Text c="dimmed">
              {ctrl.search
                ? `Tidak ada media yang cocok dengan kata kunci "${ctrl.search}".`
                : ctrl.tab === "uploads"
                  ? "Belum ada berkas media yang diunggah."
                  : "Belum ada media hasil generate."}
            </Text>
            <Button component={Link} href="/app/generate" variant="light" size="xs">
              Mulai Generate
            </Button>
          </Stack>
        </EmptyState>
      ) : ctrl.viewMode === "grid" ? (
        /* Flat Grid View without date grouping */
        <div className={classes.grid}>
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
                      src={item.url ?? ""}
                      className={classes.video}
                      muted
                      playsInline
                      loop
                      onMouseOver={(e) => void e.currentTarget.play().catch(() => {})}
                      onMouseOut={(e) => e.currentTarget.pause()}
                    />
                  ) : (
                    <img
                      src={item.url ?? ""}
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
                  <div className={classes.cardSub}>
                    {timeStr}
                    {sizeStr ? ` · ${sizeStr}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className={classes.listContainer}>
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
                      src={item.url ?? ""}
                      className={classes.listThumb}
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={item.url ?? ""}
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
                  <span>{timeStr}</span>
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
      />
    </div>
  );
}
