"use client";

import { ActionIcon, Alert, Button, Group, Paper, Text, Textarea, UnstyledButton } from "@mantine/core";
import { AppLink } from "@/components/app-link";
import { CooldownText } from "@/components/cooldown-text";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { WaitAlert } from "@/components/wait-alert";
import { useGenerateStudio } from "@/hooks/use-generate-studio";
import { hasLiveOutput, type JobView } from "@/lib/job-status";
import type { Model } from "../types";
import { GenerateAspectMenu } from "./generate-aspect-menu";
import { GenerateLibraryModal } from "./generate-library-modal";
import { GenerateSkeleton } from "./generate-skeleton";
import { ImageIcon, SparkleIcon, VideoIcon } from "./generate-icons";
import { GenerateDurationMenu, GenerateResolutionMenu } from "./generate-video-menu";
import classes from "./generate-studio.module.css";

function hasLiveJobOutput(
  job: JobView | null,
): job is JobView & { output: { url: string; contentType: string } } {
  return Boolean(job && job.output && typeof job.output.url === "string" && job.output.url.length > 0);
}

export function GenerateStudio(props: {
  available: number;
  held: number;
  models: Model[];
  jobs: JobView[];
  nextGenerateAt: string | null;
}) {
  const ctrl = useGenerateStudio(props);
  const lastJob = ctrl.lastGeneratedJob;

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
            <div className={classes.previewCard}>
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
                {ctrl.selectedRefs.map((item) => (
                  <UnstyledButton key={item.id} onClick={() => ctrl.removeRef(item.id)}>
                    <img src={item.url} alt="" className={classes.thumb} />
                  </UnstyledButton>
                ))}
              </Group>
            ) : null}
            <Textarea
              placeholder="Type to imagine"
              value={ctrl.prompt}
              onChange={(e) => ctrl.setPrompt(e.currentTarget.value)}
              autosize
              minRows={ctrl.prompt.trim() ? 3 : 1}
              maxRows={8}
              maxLength={4000}
              variant="unstyled"
              classNames={{ input: classes.textarea }}
            />
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

                {ctrl.mediaType === "image" ? (
                  <div className={classes.pillSegment}>
                    <button
                      type="button"
                      className={`${classes.pillBtn} ${ctrl.imageMode === "t2i" ? classes.pillBtnActive : ""}`}
                      onClick={() => ctrl.setImageMode("t2i")}
                    >
                      T2I
                    </button>
                    <button
                      type="button"
                      className={`${classes.pillBtn} ${ctrl.imageMode === "i2i" ? classes.pillBtnActive : ""}`}
                      onClick={() => {
                        ctrl.setImageMode("i2i");
                        if (ctrl.selectedRefs.length === 0) {
                          ctrl.openLibrary();
                        }
                      }}
                    >
                      I2I
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
        isSelected={ctrl.isSelected}
        onToggleGeneration={ctrl.toggleGeneration}
        onToggleUpload={ctrl.toggleUpload}
        onUploadClick={ctrl.openFilePicker}
      />
    </div>
  );
}
