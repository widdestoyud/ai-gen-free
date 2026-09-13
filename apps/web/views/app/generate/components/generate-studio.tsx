"use client";

import { ActionIcon, Badge, Group, Paper, Text, Textarea, UnstyledButton } from "@mantine/core";
import { AppLink } from "@/components/app-link";
import { CooldownText } from "@/components/cooldown-text";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { WaitAlert } from "@/components/wait-alert";
import { useGenerateStudio } from "@/hooks/use-generate-studio";
import type { JobView } from "@/lib/job-status";
import type { Model } from "../types";
import { GenerateAspectMenu } from "./generate-aspect-menu";
import { GenerateLibraryModal } from "./generate-library-modal";
import classes from "./generate-studio.module.css";

export function GenerateStudio(props: {
  available: number;
  held: number;
  models: Model[];
  jobs: JobView[];
  nextGenerateAt: string | null;
}) {
  const ctrl = useGenerateStudio(props);

  return (
    <div className={classes.page}>
      <div className={classes.stage}>
        {ctrl.active ? (
          <WaitAlert message="Sedang generate. Tab lain tidak bisa submit paralel." />
        ) : null}
        {ctrl.cooldownLeft > 0 && !ctrl.active ? <CooldownText until={ctrl.cooldownUntil} /> : null}
        {!ctrl.active ? (
          <EmptyState>
            Tulis prompt di bawah untuk mulai generate gambar baru. Semua hasil render tersimpan di menu{" "}
            <AppLink href="/app/library">Library</AppLink>.
          </EmptyState>
        ) : null}
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
            {ctrl.waiting ? <WaitAlert message={ctrl.error} /> : <ErrorAlert message={ctrl.error} />}
            <Group justify="space-between" mt="sm" wrap="wrap">
              <Group gap="xs">
                <ActionIcon type="button" variant="subtle" size="lg" onClick={ctrl.openLibrary} aria-label="Tambah gambar">
                  +
                </ActionIcon>
                <Badge variant="light">Image</Badge>
                {ctrl.selected ? (
                  <Badge variant="light">{ctrl.selected.displayName}</Badge>
                ) : null}
              </Group>
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  {props.available} poin
                </Text>
                <GenerateAspectMenu
                  value={ctrl.aspectRatio}
                  preview={ctrl.aspectMeta.preview}
                  onChange={ctrl.setAspectRatio}
                />
                {ctrl.prompt.trim() ? (
                  <ActionIcon type="submit" size="lg" radius="xl" disabled={!ctrl.canSend} aria-label="Generate">
                    ↑
                  </ActionIcon>
                ) : null}
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
