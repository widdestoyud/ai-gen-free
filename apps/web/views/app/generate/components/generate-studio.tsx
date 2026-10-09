"use client";

import { useEffect, useRef, useState } from "react";
import { ActionIcon, Alert, Badge, Button, Group, HoverCard, Modal, Paper, Progress, Stack, Text, Textarea, UnstyledButton } from "@mantine/core";
import { AppLink } from "@/components/app-link";
import { CooldownText } from "@/components/cooldown-text";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { UploadPolicyModal } from "@/components/upload-policy-modal";
import { WaitAlert } from "@/components/wait-alert";
import { getRefTag, useGenerateStudio, type StudioRef, type StudioUpload } from "@/hooks/use-generate-studio";
import { hasLiveOutput, type JobView } from "@/lib/job-status";
import type { Model, DefaultGenerationModelsConfig } from "../types";
import { GenerateAspectMenu } from "./generate-aspect-menu";
import { GenerateLibraryModal } from "./generate-library-modal";
import { GenerateResultModal } from "./generate-result-modal";
import { GenerateSettingsModal } from "./generate-settings-modal";
import { GenerateSkeleton } from "./generate-skeleton";
import { CloseIcon, GearIcon, ImageIcon, MagicWandIcon, SparkleIcon, VideoIcon } from "./generate-icons";
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

export function GenerateStudio(props?: {
  available?: number;
  held?: number;
  models?: Model[];
  defaults?: Partial<DefaultGenerationModelsConfig>;
  jobs?: JobView[];
  nextGenerateAt?: string | null;
  initialUploads?: StudioUpload[];
  initialUploadsTotal?: number;
  initialSpicyModeEnabled?: boolean;
  initialUploadPolicyAccepted?: boolean;
}) {
  const ctrl = useGenerateStudio(props);
  const lastJob = ctrl.lastGeneratedJob;
  const [previewRef, setPreviewRef] = useState<StudioRef | null>(null);
  const [settingsModalOpened, setSettingsModalOpened] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(25);
  const [isMagicPromptLoading, setIsMagicPromptLoading] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const hasText = Boolean(ctrl.prompt && ctrl.prompt.trim().length > 0);
  const singleLineHeight = 26;
  const maxBlurredHeight = 75;
  const maxAllowedHeight = 200;

  const measureHeight = () => {
    if (measureRef.current) {
      const scrollH = measureRef.current.scrollHeight || measureRef.current.offsetHeight;
      setContentHeight(scrollH);
    }
  };

  const handleMagicPrompt = async () => {
    const rawPrompt = ctrl.prompt.trim();
    if (!rawPrompt || isMagicPromptLoading) return;

    try {
      setIsMagicPromptLoading(true);
      const res = await fetch("/api/generate/magic-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: rawPrompt }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || "Gagal memperjelas prompt");
      }

      const data = await res.json();
      if (data.enhancedPrompt) {
        ctrl.setPrompt(data.enhancedPrompt);
      }
    } catch (err) {
      console.error("Magic prompt error:", err);
    } finally {
      setIsMagicPromptLoading(false);
    }
  };

  useEffect(() => {
    measureHeight();
  }, [ctrl.prompt]);

  const targetWrapperHeight = isPromptFocused || isMagicPromptLoading
    ? Math.min(Math.max(contentHeight || singleLineHeight, singleLineHeight), maxAllowedHeight)
    : hasText
    ? Math.min(Math.max(contentHeight || singleLineHeight, singleLineHeight), maxBlurredHeight)
    : singleLineHeight;

  const isComposerActive = hasText || ctrl.selectedRefs.length > 0;

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
          {/* Mobile Configs Row (Hanya muncul di mobile/tab ketika aktif mengetik / memilih gambar) */}
          {isComposerActive ? (
            <div className={classes.mobileConfigsRow}>
              {ctrl.spicyModeEnabled ? (
                <div className={classes.pillSegment}>
                  <button
                    type="button"
                    className={`${classes.pillBtn} ${ctrl.spicyFilter === "normal" ? classes.pillBtnActive : ""}`}
                    onClick={() => ctrl.setSpicyFilter("normal")}
                    aria-label="Filter Standard Models"
                  >
                    <span>Standard</span>
                  </button>
                  <button
                    type="button"
                    className={`${classes.pillBtn} ${ctrl.spicyFilter === "spicy" ? classes.pillBtnSpicyActive : ""}`}
                    onClick={() => ctrl.setSpicyFilter("spicy")}
                    aria-label="Filter Spicy Models"
                  >
                    <span>Spicy</span>
                  </button>
                </div>
              ) : null}

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
            </div>
          ) : null}

          <Paper className={classes.composer} radius="xl" p="md" withBorder>
            {ctrl.selectedRefs.length > 0 ? (
              <div className={classes.refThumbGallery}>
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
                          alt={tagLabel || "Thumbnail referensi"}
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

                {ctrl.selectedRefs.length < 5 ? (
                  <button
                    type="button"
                    className={classes.addRefCardMobile}
                    onClick={ctrl.openLibrary}
                    aria-label="Tambah gambar referensi"
                  >
                    +
                  </button>
                ) : null}
              </div>
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
                      <img src={item.url} alt={tagLabel || "Thumbnail mention"} className={classes.mentionThumb} />
                      <span className={classes.mentionLabel}>{tagLabel}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div
              className={classes.textareaWrapper}
              style={{ height: `${targetWrapperHeight}px` }}
            >
              {hasText ? (
                <HoverCard
                  width={280}
                  shadow="md"
                  withArrow
                  position="top-end"
                  openDelay={150}
                  closeDelay={100}
                  radius="md"
                >
                  <HoverCard.Target>
                    <button
                      type="button"
                      className={`${classes.magicPromptBtn} ${isMagicPromptLoading ? classes.magicPromptBtnLoading : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleMagicPrompt();
                      }}
                      aria-label="Magic Prompt"
                      disabled={isMagicPromptLoading}
                    >
                      <MagicWandIcon size={16} />
                    </button>
                  </HoverCard.Target>
                  <HoverCard.Dropdown p="xs">
                    <Group gap={6} mb={4} align="center">
                      <MagicWandIcon size={14} />
                      <Text size="xs" fw={700} c="violet.4">
                        Magic Prompt
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" lh={1.4}>
                      Perjelas dan tingkatkan kualitas prompt secara otomatis menggunakan AI agar hasil render lebih detail, estetik, dan sinematik.
                    </Text>
                  </HoverCard.Dropdown>
                </HoverCard>
              ) : null}
              <div
                ref={measureRef}
                className={`${classes.measureMirror} ${hasText ? classes.hasMagicBtnPadding : ""}`}
                aria-hidden="true"
              >
                {ctrl.prompt || "A"}
              </div>
              <div
                ref={backdropRef}
                className={`${classes.highlightBackdrop} ${hasText ? classes.hasMagicBtnPadding : ""}`}
                aria-hidden="true"
              >
                {renderHighlightedPrompt(ctrl.prompt, ctrl.selectedRefs)}
              </div>
              <Textarea
                ref={ctrl.textareaRef}
                placeholder="Type to imagine"
                value={ctrl.prompt}
                disabled={isMagicPromptLoading}
                onChange={(e) => {
                  ctrl.handlePromptChange(e.currentTarget.value, e.currentTarget.selectionStart);
                  measureHeight();
                }}
                onFocus={() => {
                  setIsPromptFocused(true);
                  measureHeight();
                }}
                onBlur={() => {
                  setIsPromptFocused(false);
                  if (ctrl.textareaRef.current) {
                    ctrl.textareaRef.current.scrollTop = 0;
                  }
                  if (backdropRef.current) {
                    backdropRef.current.scrollTop = 0;
                  }
                }}
                onKeyDown={ctrl.handlePromptKeyDown}
                onKeyUp={(e) => {
                  if (backdropRef.current) {
                    backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                  }
                }}
                onSelect={(e) => {
                  if (backdropRef.current) {
                    backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                  }
                }}
                onScroll={(e) => {
                  if (backdropRef.current) {
                    backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                  }
                }}
                maxLength={4000}
                variant="unstyled"
                classNames={{
                  root: classes.textareaRoot,
                  wrapper: classes.textareaInnerWrapper,
                  input: `${classes.textarea} ${
                    isPromptFocused ? classes.textareaFocused : classes.textareaBlurred
                  } ${hasText ? classes.hasMagicBtnPadding : ""}`,
                }}
              />
            </div>
            {/* Desktop Controls Row */}
            <div className={classes.desktopControlsRow}>
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

                  {ctrl.spicyModeEnabled ? (
                    <div className={classes.pillSegment}>
                      <button
                        type="button"
                        className={`${classes.pillBtn} ${ctrl.spicyFilter === "normal" ? classes.pillBtnActive : ""}`}
                        onClick={() => ctrl.setSpicyFilter("normal")}
                        aria-label="Filter Standard Models"
                      >
                        <span>Standard</span>
                      </button>
                      <button
                        type="button"
                        className={`${classes.pillBtn} ${ctrl.spicyFilter === "spicy" ? classes.pillBtnSpicyActive : ""}`}
                        onClick={() => ctrl.setSpicyFilter("spicy")}
                        aria-label="Filter Spicy Models"
                      >
                        <span>Spicy</span>
                      </button>
                    </div>
                  ) : null}
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
                    {ctrl.available} sparks
                  </Text>

                  <button
                    type="submit"
                    className={classes.fancyGenerateBtn}
                    disabled={!ctrl.canSend || isMagicPromptLoading}
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
            </div>

            {/* Mobile / Tablet Controls Row (Sesuai Referensi) */}
            <div className={classes.mobileControlsRow}>
              <div className={classes.mobileTopRow}>
                <Group gap="xs" align="center">
                  {ctrl.selectedRefs.length === 0 ? (
                    <ActionIcon
                      type="button"
                      variant="subtle"
                      size="lg"
                      onClick={ctrl.openLibrary}
                      aria-label="Tambah gambar referensi"
                      className={classes.mobileAddRefBtn}
                    >
                      +
                    </ActionIcon>
                  ) : null}
                  <div className={classes.pillSegment}>
                    <button
                      type="button"
                      className={`${classes.pillBtn} ${classes.pillBtnIconOnly} ${ctrl.mediaType === "image" ? classes.pillBtnActive : ""}`}
                      onClick={() => ctrl.setMediaType("image")}
                      aria-label="Mode Image"
                    >
                      <ImageIcon size={15} />
                    </button>
                    <button
                      type="button"
                      className={`${classes.pillBtn} ${classes.pillBtnIconOnly} ${ctrl.mediaType === "video" ? classes.pillBtnActive : ""}`}
                      onClick={() => ctrl.setMediaType("video")}
                      aria-label="Mode Video"
                    >
                      <VideoIcon size={15} />
                    </button>
                  </div>
                </Group>

                {/* Magic prompt button pada mobile / tablet (menggantikan gear icon) */}
                {isComposerActive ? (
                  <button
                    type="button"
                    className={`${classes.mobileMagicPromptBtn} ${isMagicPromptLoading ? classes.mobileMagicPromptBtnLoading : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleMagicPrompt();
                    }}
                    aria-label="Magic Prompt"
                    disabled={isMagicPromptLoading || !hasText}
                  >
                    <MagicWandIcon size={18} />
                  </button>
                ) : null}
              </div>

              <button
                type="submit"
                className={classes.mobileGenerateBtn}
                disabled={!ctrl.canSend || isMagicPromptLoading}
                aria-label="Generate"
              >
                <span>Generate</span>
                <span className={classes.generatePointBadge}>
                  <SparkleIcon size={13} />
                  <span>{ctrl.estimatedCost}</span>
                </span>
              </button>

              <Text size="xs" c="dimmed" ta="center" mt={4} fw={500}>
                {ctrl.available} sparks
              </Text>
            </div>
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

      <GenerateSettingsModal
        opened={settingsModalOpened}
        onClose={() => setSettingsModalOpened(false)}
        mediaType={ctrl.mediaType}
        spicyModeEnabled={ctrl.spicyModeEnabled}
        spicyFilter={ctrl.spicyFilter}
        onSpicyFilterChange={ctrl.setSpicyFilter}
        aspectRatio={ctrl.aspectRatio}
        onAspectRatioChange={ctrl.setAspectRatio}
        videoResolution={ctrl.videoResolution}
        onVideoResolutionChange={ctrl.setVideoResolution}
        videoDuration={ctrl.videoDuration}
        onVideoDurationChange={ctrl.setVideoDuration}
        selectedRefs={ctrl.selectedRefs}
        onOpenLibrary={ctrl.openLibrary}
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
        selectedCount={ctrl.selectedRefs.length}
        maxSelected={5}
        onToggleGeneration={ctrl.toggleGeneration}
        onToggleUpload={ctrl.toggleUpload}
        onUploadClick={ctrl.openFilePicker}
        onDeleteUpload={ctrl.deleteUpload}
        onUpdateAlias={ctrl.updateAlias}
        uploadPolicyAccepted={ctrl.uploadPolicyAccepted}
      />

      <GenerateResultModal
        opened={ctrl.resultModalOpened}
        onClose={ctrl.closeResultModal}
        job={lastJob}
      />

      <UploadPolicyModal
        opened={ctrl.uploadPolicyModalOpened}
        onClose={() => ctrl.setUploadPolicyModalOpened(false)}
        onAccept={ctrl.acceptUploadPolicy}
        loading={ctrl.policySaving}
        error={ctrl.policyError}
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

                <Text size="xs" c="dimmed">
                  Gunakan tag{" "}
                  <Text component="span" fw={600} c="green">
                    {getRefTag(activePreviewRef)}
                  </Text>{" "}
                  pada prompt untuk mereferensikan gambar ini.
                </Text>
              </Stack>
            ) : null}
          </Modal>
        );
      })()}
    </div>
  );
}

