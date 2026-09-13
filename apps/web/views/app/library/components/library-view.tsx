"use client";

import {
  Badge,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { WaitAlert } from "@/components/wait-alert";
import { useLibrary, type MediaFilter } from "@/hooks/use-library";
import type { JobView } from "@/lib/job-status";
import classes from "./library-view.module.css";

function MediaStackIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M3 7.5h4" />
      <path d="M3 12h18" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m10 8 6 4-6 4V8Z" />
      <rect width="20" height="16" x="2" y="4" rx="2" />
    </svg>
  );
}

export function LibraryView(props: {
  initialJobs: JobView[];
  nextGenerateAt?: string | null;
}) {
  const ctrl = useLibrary(props);

  return (
    <div className={classes.container}>
      <div className={classes.headerRow}>
        <Title order={2} className={classes.title}>
          Media
        </Title>
        {ctrl.succeededJobs.length > 0 ? (
          <SegmentedControl
            value={ctrl.filter}
            onChange={(val) => ctrl.setFilter(val as MediaFilter)}
            data={[
              { label: `Semua (${ctrl.counts.all})`, value: "all" },
              { label: `Gambar (${ctrl.counts.images})`, value: "images" },
              { label: `Video (${ctrl.counts.videos})`, value: "videos" },
            ]}
            size="xs"
            radius="md"
          />
        ) : null}
      </div>

      {ctrl.active ? (
        <WaitAlert message="Sedang memproses render baru di latar belakang..." />
      ) : null}

      {ctrl.filteredJobs.length === 0 ? (
        <EmptyState>
          <Stack align="center" gap="xs">
            <Text>Belum ada media yang di-render.</Text>
            <Button component={Link} href="/app/generate" variant="light" size="xs">
              Mulai Generate
            </Button>
          </Stack>
        </EmptyState>
      ) : (
        <div className={classes.grid}>
          {ctrl.filteredJobs.map((job) => {
            const isVideo =
              job.mode?.includes("video") ||
              job.output?.contentType.startsWith("video/");
            return (
              <UnstyledButton
                key={job.id}
                className={classes.card}
                onClick={() => ctrl.openPreview(job)}
              >
                {isVideo ? (
                  <video
                    src={job.output?.url ?? ""}
                    className={classes.video}
                    muted
                    playsInline
                    loop
                    onMouseOver={(e) => void e.currentTarget.play().catch(() => {})}
                    onMouseOut={(e) => e.currentTarget.pause()}
                  />
                ) : (
                  <img
                    src={job.output?.url ?? ""}
                    alt={job.prompt}
                    loading="lazy"
                    className={classes.image}
                  />
                )}
                <div className={classes.overlayIcon}>
                  {isVideo ? <VideoIcon /> : <MediaStackIcon />}
                </div>
                <div className={classes.hoverPrompt}>
                  <div className={classes.promptText}>{job.prompt}</div>
                </div>
              </UnstyledButton>
            );
          })}
        </div>
      )}

      <Modal
        opened={ctrl.previewOpened}
        onClose={ctrl.closePreview}
        title="Detail Media"
        size="lg"
        centered
      >
        {ctrl.selectedJob ? (
          <Stack gap="md">
            {ctrl.selectedJob.output?.contentType.startsWith("video/") ? (
              <video
                src={ctrl.selectedJob.output.url ?? ""}
                controls
                autoPlay
                className={classes.modalImage}
              />
            ) : (
              <img
                src={ctrl.selectedJob.output?.url ?? ""}
                alt={ctrl.selectedJob.prompt}
                className={classes.modalImage}
              />
            )}

            <Stack gap="xs">
              <Group justify="space-between">
                <Badge variant="light" size="sm">
                  {ctrl.selectedJob.mode?.toUpperCase() ?? "T2I"}
                </Badge>
                {ctrl.selectedJob.createdAt ? (
                  <Text size="xs" c="dimmed">
                    {new Date(ctrl.selectedJob.createdAt).toLocaleString("id-ID")}
                  </Text>
                ) : null}
              </Group>

              <Text size="sm" fw={500}>
                {ctrl.selectedJob.prompt}
              </Text>

              <Group justify="flex-end" gap="xs" mt="sm">
                {ctrl.selectedJob.output?.url ? (
                  <Button
                    component="a"
                    href={ctrl.selectedJob.output.url}
                    target="_blank"
                    download={`media-${ctrl.selectedJob.id}`}
                    variant="default"
                    size="xs"
                  >
                    Unduh
                  </Button>
                ) : null}
                <Button
                  component={Link}
                  href={`/jobs/${ctrl.selectedJob.id}`}
                  variant="filled"
                  size="xs"
                >
                  Buka Halaman Job
                </Button>
              </Group>
            </Stack>
          </Stack>
        ) : null}
      </Modal>
    </div>
  );
}
