"use client";

import { Button, Group, Modal, NavLink, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import type { JobView } from "@/lib/job-status";
import type { StudioUpload } from "@/hooks/use-generate-studio";
import classes from "./generate-studio.module.css";

export function GenerateLibraryModal({
  opened,
  onClose,
  tab,
  onTab,
  generations,
  uploads,
  isSelected,
  onToggleGeneration,
  onToggleUpload,
  onUploadClick,
}: {
  opened: boolean;
  onClose: () => void;
  tab: "generations" | "uploads";
  onTab: (tab: "generations" | "uploads") => void;
  generations: JobView[];
  uploads: StudioUpload[];
  isSelected: (id: string) => boolean;
  onToggleGeneration: (job: JobView) => void;
  onToggleUpload: (item: StudioUpload) => void;
  onUploadClick: () => void;
}) {
  const items = tab === "generations" ? generations : uploads;

  return (
    <Modal opened={opened} onClose={onClose} title="Pilih gambar" size="xl" centered>
      <Group align="flex-start" gap="lg" wrap="nowrap">
        <Stack gap={4} className={classes.libraryNav}>
          <NavLink
            label="Generations"
            active={tab === "generations"}
            onClick={() => onTab("generations")}
          />
          <NavLink label="Uploads" active={tab === "uploads"} onClick={() => onTab("uploads")} />
          <NavLink label="Upload media" onClick={onUploadClick} />
        </Stack>
        <Stack gap="sm" className={classes.libraryMain}>
          <Group justify="space-between">
            <Text fw={600}>{tab === "generations" ? "Generations" : "Uploads"}</Text>
            <Button type="button" size="xs" onClick={onUploadClick}>
              + Upload
            </Button>
          </Group>
          {items.length === 0 ? (
            <Text c="dimmed" size="sm">
              {tab === "generations" ? "Belum ada hasil generate." : "Belum ada unggahan."}
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="xs" className={classes.libraryGrid}>
              {tab === "generations"
                ? generations.map((job) => (
                    <UnstyledButton
                      key={job.id}
                      onClick={() => onToggleGeneration(job)}
                      className={isSelected(job.id) ? classes.tileSelected : undefined}
                    >
                      <img src={job.output?.url ?? ""} alt={job.prompt} />
                    </UnstyledButton>
                  ))
                : uploads.map((item) => (
                    <UnstyledButton
                      key={item.id}
                      onClick={() => onToggleUpload(item)}
                      className={isSelected(item.id) ? classes.tileSelected : undefined}
                    >
                      <img src={item.url} alt={item.name} />
                    </UnstyledButton>
                  ))}
            </SimpleGrid>
          )}
        </Stack>
      </Group>
    </Modal>
  );
}
