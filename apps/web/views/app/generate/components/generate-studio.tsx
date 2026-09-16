"use client";

import { useRef, useState } from "react";
import { ActionIcon, Alert, Badge, Button, Group, Modal, Paper, Progress, Stack, Text, Textarea, UnstyledButton } from "@mantine/core";
import { AppLink } from "@/components/app-link";
import { CooldownText } from "@/components/cooldown-text";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { WaitAlert } from "@/components/wait-alert";
import { getRefTag, useGenerateStudio, type StudioRef, type StudioUpload } from "@/hooks/use-generate-studio";
import { hasLiveOutput, type JobView } from "@/lib/job-status";
import type { Model } from "../types";
import { GenerateAspectMenu } from "./generate-aspect-menu";
import { GenerateLibraryModal } from "./generate-library-modal";
import { GenerateResultModal } from "./generate-result-modal";
import { GenerateSkeleton } from "./generate-skeleton";
import { CloseIcon, ImageIcon, SparkleIcon, VideoIcon } from "./generate-icons";
import { GenerateDurationMenu, GenerateResolutionMenu } from "./generate-video-menu";
import classes from "./generate-studio.module.css";

function hasLiveJobOutput(
  job: JobView | null,
): job is JobView & { output: { url: string; contentType: string } } {
  return Boolean(job && job.output && typeof job.output.url === "string" && job.output.url.length > 0);
}

function renderHighlightedPrompt(promptText: string, activeRefs: StudioRef[]) {
  if (!promptText) return null;

  const activeTags = new Set<string>();
  activeRefs.forEach((ref, idx) => {
    const tag = getRefTag(ref, idx).toLowerCase();
    activeTags.add(tag);
    if (ref.alias && ref.alias.trim().length > 0) {
      activeTags.add(`@${ref.alias.trim().toLowerCase()}`);
    }
    if (ref.tag && ref.tag.trim().length > 0) {
      const clean = ref.tag.trim().toLowerCase();
      activeTags.add(clean.startsWith("@") ? clean : `@${clean}`);
    }
  });

  const parts = promptText.split(/(@[a-zA-Z0-9_-]+)/g);
  const elements = parts.map((part, i) => {
    if (part.startsWith("@")) {
      const isAvailable = activeTags.has(part.toLowerCase());
      return (
        <span
          key={i}
          className={isAvailable ? classes.mentionTagActive : classes.mentionTagDeleted}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });

  if (promptText.endsWith("\n")) {
    elements.push(<span key="trailing-newline">{"\u200B"}</span>);
  }

  return elements;
}

export function GenerateStudio(props: {
  available: number;
  held: number;
  models: Model[];
  jobs: JobView[];
  nextGenerateAt: string | null;
  initialUploads?: StudioUpload[];
  initialUploadsTotal?: number;
}) {
  const ctrl = useGenerateStudio(props);
  const lastJob = ctrl.lastGeneratedJob;
  const [previewRef, setPreviewRef] = useState<StudioRef | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  return (
    <div className={classes.page}>
      <div className={classes.stage}>
        {ctrl.isGenerating ? (
          <GenerateSkeleton
            aspectRatio={ctrl.aspectRatio}
            progress={ctrl.active?.progressPct}
            mediaType={ctrl.mediaType}
          />
        ) : hasLiveJobOutput(lastJob) ? (
          <div className={classes.previewContainerFull}>
            {ctrl.cooldownLeft > 0 ? (
              <Alert color="yellow" variant="light" radius="md" className={classes.stageAlert}>
                <CooldownText until={ctrl.cooldownUntil} />
              </Alert>
            ) : null}
            <div className={classes.previewCard} onClick={ctrl.openResultModal} role="button" tabIndex={0}>
              <div className={classes.stageMediaWrapper}>
                {lastJob.output.contentType.includes("video") ||
                lastJob.mode === "t2v" ||
                lastJob.mode === "i2v" ? (
                  <video
                    src={lastJob.output.url}
                    controls
                    autoPlay
                    loop
                    className={classes.stageMedia}
                  />
                ) : (
                  <img
                    src={lastJob.output.url}
                    alt={lastJob.prompt}
                    className={classes.stageMedia}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={classes.stageDefaultWrapper}>
            {ctrl.error ? (
              ctrl.waiting ? (
                <div className={classes.stageAlert}>
                  <WaitAlert message={ctrl.error} />
                </div>
              ) : (
                <div className={classes.stageAlert}>
                  <ErrorAlert message={ctrl.error} />
                </div>
              )
            ) : null}
            {ctrl.cooldownLeft > 0 ? <CooldownText until={ctrl.cooldownUntil} /> : null}
            <EmptyState>
              Tulis prompt di bawah untuk mulai generate gambar baru. Semua hasil render tersimpan di menu{" "}
              <AppLink href="/app/library">Library</AppLink>.
            </EmptyState>
          </div>
        )}
      </div>

      <div className={classes.dock}>
        <form onSubmit={(e) => void ctrl.submit(e)}>
          <Paper className={classes.composer} radius="xl" p="md" withBorder>
            {ctrl.selectedRefs.length > 0 ? (
              <Group gap="xs" mb="sm">
                {ctrl.selectedRefs.map((item, idx) => {
                  const tagLabel = getRefTag(item, idx);
                  return (
                    <div key={item.id} className={classes.thumbWrapper}>
                      <UnstyledButton
                        type="button"
                        onClick={() => !item.uploading && setPreviewRef(item)}
                        className={classes.thumbInner}
                        aria-label={`Lihat gambar ${tagLabel}`}
                      >
                        <img
                          src={item.url}
                          alt=""
                          className={`${classes.thumb} ${item.uploading ? classes.thumbBlur : ""}`}
                        />
                        {item.uploading ? (
                          <div className={classes.thumbProgressOverlay}>
                            <Progress
                              value={item.progress ?? 0}
                              size="xs"
                              radius="xl"
                              color="blue"
                              animated
                              className={classes.thumbProgressBar}
                            />
                          </div>
                        ) : null}
                      </UnstyledButton>
                      {!item.uploading ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            ctrl.removeRef(item.id);
                          }}
                          className={classes.thumbCloseBtn}
                          aria-label="Hapus gambar referensi"
                        >
                          <CloseIcon size={10} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </Group>
            ) : null}
            {ctrl.mentionOpen && ctrl.selectedRefs.length > 0 ? (
              <div className={classes.mentionDropdown}>
                {ctrl.selectedRefs.map((item, idx) => {
                  const tagLabel = item.alias && item.alias.trim().length > 0 ? `@${item.alias.trim()}` : `@image${idx + 1}`;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`${classes.mentionItem} ${idx === ctrl.mentionIndex ? classes.mentionItemActive : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        ctrl.selectMention(idx);
                      }}
                    >
                      <img src={item.url} alt="" className={classes.mentionThumb} />
                      <span className={classes.mentionLabel}>{tagLabel}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className={classes.textareaWrapper}>
              <div ref={backdropRef} className={classes.highlightBackdrop} aria-hidden="true">
                {renderHighlightedPrompt(ctrl.prompt, ctrl.selectedRefs)}
              </div>
              <Textarea
                ref={ctrl.textareaRef}
                placeholder="Type to imagine"
                value={ctrl.prompt}
                onChange={(e) => ctrl.handlePromptChange(e.currentTarget.value, e.currentTarget.selectionStart)}
                onKeyDown={ctrl.handlePromptKeyDown}
                onScroll={(e) => {
                  if (backdropRef.current) {
                    backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                  }
                }}
                autosize
                minRows={ctrl.prompt.trim() ? 3 : 1}
                maxRows={8}
                maxLength={4000}
                variant="unstyled"
                classNames={{ input: classes.textarea }}
              />
            </div>
            <Group justify="space-between" mt="sm" wrap="wrap" gap="xs">
              <Group gap="xs" align="center">
                <ActionIcon type="button" variant="subtle" size="lg" onClick={ctrl.openLibrary} aria-label="Tambah gambar">
                  +
                </ActionIcon>
                <div className={classes.pillSegment}>
                  <button
                    type="button"
                    className={`${classes.pillBtn} ${ctrl.mediaType === "image" ? classes.pillBtnActive : classes.pillBtnIconOnly}`}
                    onClick={() => ctrl.setMediaType("image")}
                    aria-label="Mode Image"
                  >
                    <ImageIcon size={15} />
                    {ctrl.mediaType === "image" ? <span>Image</span> : null}
                  </button>
                  <button
                    type="button"
                    className={`${classes.pillBtn} ${ctrl.mediaType === "video" ? classes.pillBtnActive : classes.pillBtnIconOnly}`}
                    onClick={() => ctrl.setMediaType("video")}
                    aria-label="Mode Video"
                  >
                    <VideoIcon size={15} />
                    {ctrl.mediaType === "video" ? <span>Video</span> : null}
                  </button>
                </div>
              </Group>

              <Group gap="xs" align="center">
                {ctrl.mediaType === "video" ? (
                  <>
                    <GenerateResolutionMenu
                      value={ctrl.videoResolution}
                      onChange={ctrl.setVideoResolution}
                    />
                    <GenerateDurationMenu
                      value={ctrl.videoDuration}
                      onChange={ctrl.setVideoDuration}
                    />
                  </>
                ) : null}

                <GenerateAspectMenu
                  value={ctrl.aspectRatio}
                  preview={ctrl.aspectMeta.preview}
                  onChange={ctrl.setAspectRatio}
                />

                <Text size="sm" c="dimmed" fw={500}>
                  {props.available} poin
                </Text>

                <button
                  type="submit"
                  className={classes.fancyGenerateBtn}
                  disabled={!ctrl.canSend}
                  aria-label="Generate"
                >
                  <span>Generate</span>
                  <span className={classes.generatePointBadge}>
                    <SparkleIcon size={13} />
                    <span>{ctrl.estimatedCost}</span>
                  </span>
                </button>
              </Group>
            </Group>
          </Paper>
        </form>
        {!ctrl.selected ? <EmptyState>Tidak ada model t2i aktif.</EmptyState> : null}
      </div>

      <input
        ref={ctrl.fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className={classes.hiddenInput}
        onChange={ctrl.onFiles}
      />

      <GenerateLibraryModal
        opened={ctrl.libraryOpened}
        onClose={ctrl.closeLibrary}
        tab={ctrl.libraryTab}
        onTab={ctrl.setLibraryTab}
        generations={ctrl.gallery}
        uploads={ctrl.uploads}
        uploadPage={ctrl.uploadPage}
        uploadTotal={ctrl.uploadTotal}
        onUploadPageChange={ctrl.onUploadPageChange}
        isSelected={ctrl.isSelected}
        onToggleGeneration={ctrl.toggleGeneration}
        onToggleUpload={ctrl.toggleUpload}
        onUploadClick={ctrl.openFilePicker}
        onDeleteUpload={ctrl.deleteUpload}
        onUpdateAlias={ctrl.updateAlias}
      />

      <GenerateResultModal
        opened={ctrl.resultModalOpened}
        onClose={ctrl.closeResultModal}
        job={lastJob}
      />

      {/* Modal Lihat Detail Media (Full Size Preview + Metadata) */}
      {(() => {
        const activePreviewRef = previewRef
          ? (ctrl.selectedRefs.find((r) => r.id === previewRef.id) ?? previewRef)
          : null;

        return (
          <Modal
            opened={Boolean(activePreviewRef)}
            onClose={() => setPreviewRef(null)}
            title="Detail Media Referensi"
            size="lg"
            centered
          >
            {activePreviewRef ? (
              <Stack gap="md">
                <div className={classes.zoomImageContainer}>
                  <img
                    src={activePreviewRef.url}
                    alt={activePreviewRef.name ?? "Media Referensi"}
                    className={classes.zoomImage}
                  />
                </div>

                <Paper p="sm" withBorder radius="md">
                  <Group justify="space-between" wrap="wrap" gap="sm">
                    <div>
                      <Text size="xs" c="dimmed">
                        Sumber Media
                      </Text>
                      <Group gap={6} mt={2}>
                        <Badge
                          size="sm"
                          variant="light"
                          color={activePreviewRef.kind === "upload" ? "blue" : "violet"}
                        >
                          {activePreviewRef.kind === "upload" ? "Upload Media" : "Hasil Generation"}
                        </Badge>
                      </Group>
                    </div>

                    <div>
                      <Text size="xs" c="dimmed">
                        Tipe
                      </Text>
                      <Text size="sm" fw={600}>
                        Gambar (Image)
                      </Text>
                    </div>

                    <div>
                      <Text size="xs" c="dimmed">
                        Format
                      </Text>
                      <Badge size="sm" variant="outline" color="gray">
                        {activePreviewRef.format ?? (activePreviewRef.url.split(".").pop()?.toUpperCase() || "WEBP")}
                      </Badge>
                    </div>

                    {activePreviewRef.width && activePreviewRef.height ? (
                      <div>
                        <Text size="xs" c="dimmed">
                          Resolusi
                        </Text>
                        <Text size="sm" fw={600}>
                          {activePreviewRef.width} × {activePreviewRef.height} px
                        </Text>
                      </div>
                    ) : null}
                  </Group>
                </Paper>

                <Group justify="space-between" align="center">
                  <Text size="xs" c="dimmed">
                    Gunakan tag{" "}
                    <Text component="span" fw={600} c="green">
                      {getRefTag(activePreviewRef)}
                    </Text>{" "}
                    pada prompt untuk mereferensikan gambar ini.
                  </Text>
                  <Button
                    variant="default"
                    size="xs"
                    onClick={() => setPreviewRef(null)}
                  >
                    Tutup
                  </Button>
                </Group>
              </Stack>
            ) : null}
          </Modal>
        );
      })()}
    </div>
  );
}

