"use client";

import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import type { JobView } from "@/lib/job-status";
import classes from "./generate-result-modal.module.css";

function DownloadIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CopyIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function formatModeLabel(mode?: string): string {
  if (!mode) return "Text-To-Image";
  const m = mode.toLowerCase();
  if (m === "t2i") return "Text-To-Image";
  if (m === "i2i") return "Image-To-Image";
  if (m === "t2v") return "Text-To-Video";
  if (m === "i2v") return "Image-To-Video";
  return mode.toUpperCase();
}

export function GenerateResultModal({
  opened,
  onClose,
  job,
}: {
  opened: boolean;
  onClose: () => void;
  job: JobView | null;
}) {
  if (!job) return null;

  const isVideo =
    job.mode?.includes("video") || job.output?.contentType.startsWith("video/");

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Hasil Generate"
      size="90%"
      centered
      classNames={{
        content: classes.modalContentFull,
        body: classes.modalBodyNoPadding,
        header: classes.modalHeaderClean,
      }}
    >
      <div className={classes.detailModalLayout}>
        {/* Kolom Kiri: Media Showcase */}
        <div className={classes.mediaShowcaseSection}>
          <div className={classes.mediaViewerWrapper}>
            {isVideo ? (
              <video
                src={job.output?.url ?? ""}
                controls
                autoPlay
                loop
                className={classes.detailMedia}
              />
            ) : (
              <img
                src={job.output?.url ?? ""}
                alt={job.prompt}
                className={classes.detailMedia}
              />
            )}
          </div>
        </div>

        {/* Kolom Kanan: Detail & Aksi Media */}
        <div className={classes.detailInfoSidebar}>
          <ScrollArea type="hover" className={classes.sidebarScroll}>
            <Stack gap="md" p="md">
              {/* Status & Mode Badges */}
              <Group justify="space-between" align="center">
                <Badge variant="light" color="blue" size="md" radius="sm">
                  {formatModeLabel(job.mode)}
                </Badge>
                <Badge variant="light" color="green" size="md" radius="sm">
                  Completed
                </Badge>
              </Group>

              {/* Tombol Aksi Utama (Download) */}
              {job.output?.url ? (
                <Button
                  component="a"
                  href={job.output.url}
                  target="_blank"
                  download={`ai-gen-${job.id}`}
                  variant="filled"
                  color="dark.4"
                  size="md"
                  radius="md"
                  fullWidth
                  mt="xs"
                  leftSection={<DownloadIcon size={18} />}
                  className={classes.primaryDownloadBtn}
                >
                  Download
                </Button>
              ) : null}

              {/* Box Prompt */}
              <div className={classes.promptSection}>
                <Group justify="space-between" align="center" mb={6}>
                  <Text size="sm" fw={700} c="dimmed" tt="uppercase" lts={0.5}>
                    prompt
                  </Text>
                  <CopyButton value={job.prompt} timeout={2000}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Tersalin" : "Salin prompt"} withArrow position="left">
                        <ActionIcon
                          variant="subtle"
                          color={copied ? "teal" : "gray"}
                          size="sm"
                          onClick={copy}
                          aria-label="Salin teks prompt"
                        >
                          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
                <Text size="sm" className={classes.promptParagraph}>
                  {job.prompt}
                </Text>
              </div>

              {/* Spesifikasi & Metadata Gambar */}
              <div className={classes.metaProperties}>
                <div className={classes.metaRow}>
                  <Text size="xs" c="dimmed">
                    Biaya
                  </Text>
                  <Text size="xs" fw={600}>
                    {job.cost} Poin
                  </Text>
                </div>

                {job.createdAt ? (
                  <div className={classes.metaRow}>
                    <Text size="xs" c="dimmed">
                      Dibuat
                    </Text>
                    <Text size="xs" fw={500}>
                      {new Date(job.createdAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </Text>
                  </div>
                ) : null}

                {job.output?.availableUntil ? (
                  <div className={classes.metaRow}>
                    <Text size="xs" c="dimmed">
                      Masa Berlaku
                    </Text>
                    <Text size="xs" fw={500}>
                      {new Date(job.output.availableUntil).toLocaleDateString("id-ID", {
                        dateStyle: "medium",
                      })}
                    </Text>
                  </div>
                ) : null}
              </div>
            </Stack>
          </ScrollArea>

          {/* Footer ID */}
          <div className={classes.sidebarFooter}>
            <Group justify="space-between" align="center">
              <Text size="xs" c="dimmed" ff="monospace" lineClamp={1}>
                ID: {job.id}
              </Text>
              <CopyButton value={job.id} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "ID Tersalin" : "Salin ID"} withArrow position="left">
                    <ActionIcon
                      variant="subtle"
                      color={copied ? "teal" : "gray"}
                      size="xs"
                      onClick={copy}
                      aria-label="Salin ID job"
                    >
                      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </div>
        </div>
      </div>
    </Modal>
  );
}
