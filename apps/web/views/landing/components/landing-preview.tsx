"use client";

import { Text, Group, Badge, Button } from "@mantine/core";
import classes from "./landing.module.css";
import type { PreviewTab } from "@/hooks/use-landing-page";

interface LandingPreviewProps {
  activePreview: PreviewTab;
  onSelectPreview: (tab: PreviewTab) => void;
  onStartCreation: () => void;
}

export function LandingPreview({
  activePreview,
  onSelectPreview,
  onStartCreation,
}: LandingPreviewProps) {
  return (
    <div className={classes.previewContainer}>
      <div className={classes.previewTopBar}>
        <Group gap="xs">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
          <Text size="xs" fw={700} c="dimmed">
            STUDIO PREVIEW
          </Text>
        </Group>

        <div className={classes.previewTabs}>
          <button
            type="button"
            className={`${classes.previewTabBtn} ${
              activePreview === "image" ? classes.previewTabBtnActive : ""
            }`}
            onClick={() => onSelectPreview("image")}
          >
            Foto Produk (T2I)
          </button>
          <button
            type="button"
            className={`${classes.previewTabBtn} ${
              activePreview === "video" ? classes.previewTabBtnActive : ""
            }`}
            onClick={() => onSelectPreview("video")}
          >
            Video Sinematik
          </button>
          <button
            type="button"
            className={`${classes.previewTabBtn} ${
              activePreview === "prompt" ? classes.previewTabBtnActive : ""
            }`}
            onClick={() => onSelectPreview("prompt")}
          >
            Konsep Editorial
          </button>
        </div>
      </div>

      <div className={classes.previewContent}>
        {activePreview === "image" && (
          <>
            <div className={`${classes.showcaseVisual} ${classes.showcaseImageBg}`}>
              <Badge color="blue" variant="filled" size="sm">
                Kebutuhan: Katalog Produk Komersial
              </Badge>
            </div>
            <div className={classes.promptCard}>
              <Text size="xs" fw={700} c="blue.4">
                SIMULASI DESKRIPSI PRODUK
              </Text>
              <Text size="sm" c="gray.2" mt={4}>
                &ldquo;Foto studio profesional botol parfum kaca mewah di atas marmer hitam dengan
                pencahayaan dramatis, refleksi air jernih, dan detail tekstur ultra-HD 4K.&rdquo;
              </Text>
              <Group justify="space-between" mt="sm">
                <Text size="xs" c="dimmed">
                  Rasio: 1:1 Persegi · Siap pakai untuk katalog toko &amp; marketplace
                </Text>
                <Button size="xs" variant="light" color="blue" onClick={onStartCreation}>
                  Coba Sekarang
                </Button>
              </Group>
            </div>
          </>
        )}

        {activePreview === "video" && (
          <>
            <div className={`${classes.showcaseVisual} ${classes.showcaseVideoBg}`}>
              <Badge color="grape" variant="filled" size="sm">
                Kebutuhan: Video Promosi Dinamis
              </Badge>
            </div>
            <div className={classes.promptCard}>
              <Text size="xs" fw={700} c="grape.4">
                DESKRIPSI VIDEO SINEMATIK
              </Text>
              <Text size="sm" c="gray.2" mt={4}>
                &ldquo;Kamera bergerak dinamis mengitari mobil sport modern di jalanan kota malam
                hari dengan lampu neon redup, refleksi basah di aspal, gerakan halus 60fps.&rdquo;
              </Text>
              <Group justify="space-between" mt="sm">
                <Text size="xs" c="dimmed">
                  Durasi: 10s · Resolusi: 1080p HD untuk media sosial
                </Text>
                <Button size="xs" variant="light" color="grape" onClick={onStartCreation}>
                  Generate Video
                </Button>
              </Group>
            </div>
          </>
        )}

        {activePreview === "prompt" && (
          <>
            <div className={`${classes.showcaseVisual} ${classes.showcasePromptBg}`}>
              <Badge color="teal" variant="filled" size="sm">
                Kebutuhan: Materi Iklan &amp; Banner
              </Badge>
            </div>
            <div className={classes.promptCard}>
              <Text size="xs" fw={700} c="teal.4">
                KONSEP EDITORIAL &amp; KAMPANYE
              </Text>
              <Text size="sm" c="gray.2" mt={4}>
                &ldquo;Model potret editorial fashion dengan gaun satin minimalis, pencahayaan studio
                sinematik lembut, komposisi bersih untuk materi kampanye digital.&rdquo;
              </Text>
              <Group justify="space-between" mt="sm">
                <Text size="xs" c="dimmed">
                  Rasio: 16:9 Landscape siap pakai
                </Text>
                <Button size="xs" variant="light" color="teal" onClick={onStartCreation}>
                  Bikin Visual
                </Button>
              </Group>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
