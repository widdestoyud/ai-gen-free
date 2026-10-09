"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Slider,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { LibraryItem } from "@/hooks/use-library";
import { resolveUploadUrl } from "@/lib/format";
import { requestJson } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { ErrorAlert } from "@/components/error-alert";
import { MaskCanvas, type MaskCanvasRef, type ToolMode } from "./mask-canvas";
import classes from "./inpaint-editor.module.css";

function BrushIcon({ size = 16 }: { size?: number }) {
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
      <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.34-3 3 0 .83.34 1.58.88 2.12C5.5 20.62 6.25 21 7.07 21c1.66 0 3-1.34 3-3 0-.82-.34-1.57-.88-2.11" />
    </svg>
  );
}

function EraserIcon({ size = 16 }: { size?: number }) {
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
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  );
}

function UndoIcon({ size = 14 }: { size?: number }) {
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
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

function RedoIcon({ size = 14 }: { size?: number }) {
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
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </svg>
  );
}

function TrashIcon({ size = 14 }: { size?: number }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function SparkleIcon({ size = 14 }: { size?: number }) {
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
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

type InpaintEditorModalProps = {
  opened: boolean;
  onClose: () => void;
  item: LibraryItem | null;
  onSuccess?: () => void;
};

export function InpaintEditorModal({ opened, onClose, item, onSuccess }: InpaintEditorModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const maskCanvasRef = useRef<MaskCanvasRef>(null);

  const [toolMode, setToolMode] = useState<ToolMode>("brush");
  const [brushSize, setBrushSize] = useState<number>(30);
  const [brushOpacity, setBrushOpacity] = useState<number>(0.65);
  const [prompt, setPrompt] = useState<string>("");

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasMask, setHasMask] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleHistoryChange = useCallback(
    (undoAvailable: boolean, redoAvailable: boolean, maskAvailable: boolean) => {
      setCanUndo(undoAvailable);
      setCanRedo(redoAvailable);
      setHasMask(maskAvailable);
    },
    [],
  );

  if (!item || !item.url) return null;
  const imageUrl = resolveUploadUrl(item.url);

  const handleSubmit = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!prompt.trim()) {
      setErrorMsg("Harap masukkan deskripsi perubahan / prompt edit.");
      return;
    }

    const maskDataUrl = maskCanvasRef.current?.getMaskDataUrl();
    if (!maskDataUrl || !hasMask) {
      setErrorMsg("Harap tandai area yang ingin diedit dengan kuas (brush) terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestJson<{ job_id?: string; id?: string }>("/api/generate/image-edit", {
        method: "POST",
        body: JSON.stringify({
          prompt: prompt.trim(),
          image: item.id,
          mask: maskDataUrl,
          aspectRatio: "1:1",
        }),
      });

      setSuccessMsg("Pekerjaan inpaint berhasil dikirim! Mengalihkan ke studio generate...");
      await queryClient.invalidateQueries({ queryKey: queryKeys.library() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.generatedJobs() });

      if (onSuccess) {
        onSuccess();
      }

      const jobId = res.ok && res.data ? (res.data.job_id || res.data.id) : null;

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
        router.push(jobId ? `/app/generate?jobId=${encodeURIComponent(jobId)}` : "/app/generate");
      }, 300);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || "Gagal mengirim permintaan inpaint. Silakan coba lagi.");
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      size="100%"
      centered
      padding={0}
      withCloseButton={false}
      classNames={{
        root: classes.modalRoot,
        inner: classes.modalInner,
        content: classes.modalContent,
        body: classes.modalBody,
      }}
      zIndex={350}
    >
      {/* Modal Header */}
      <div className={classes.modalHeader}>
        <div className={classes.modalTitle}>
          <div className={classes.salmonTag}>
            <span className={classes.salmonDot} />
            <span>Brush Merah Salmon</span>
          </div>
          <span>Edit & Inpaint Gambar</span>
        </div>

        <Group gap="xs">
          <Badge color="violet" variant="light" size="md" leftSection={<SparkleIcon size={12} />}>
            10 Sparks
          </Badge>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            aria-label="Tutup Editor"
          >
            ✕
          </ActionIcon>
        </Group>
      </div>

      {/* Editor Body Layout */}
      <div className={classes.editorLayout}>
        {/* Canvas Visual Mask Area */}
        <MaskCanvas
          ref={maskCanvasRef}
          imageUrl={imageUrl}
          toolMode={toolMode}
          brushSize={brushSize}
          brushOpacity={brushOpacity}
          onHistoryChange={handleHistoryChange}
        />

        {/* Control Sidebar */}
        <div className={classes.controlSidebar}>
          <div className={classes.sidebarContent}>
            {/* Alat Kuas & Penghapus */}
            <div>
              <div className={classes.sectionHeading}>Alat Gambar</div>
              <div className={classes.toolGroup}>
                <button
                  type="button"
                  className={`${classes.toolBtn} ${toolMode === "brush" ? classes.toolBtnActive : ""}`}
                  onClick={() => setToolMode("brush")}
                >
                  <BrushIcon size={15} />
                  <span>Kuas (Mask)</span>
                </button>
                <button
                  type="button"
                  className={`${classes.toolBtn} ${toolMode === "eraser" ? classes.toolBtnEraserActive : ""}`}
                  onClick={() => setToolMode("eraser")}
                >
                  <EraserIcon size={15} />
                  <span>Penghapus</span>
                </button>
              </div>
            </div>

            {/* Pengaturan Ukuran Brush */}
            <div className={classes.sliderRow}>
              <div className={classes.sliderHeader}>
                <span>Ukuran Brush</span>
                <span className={classes.sliderValue}>{brushSize}px</span>
              </div>
              <Slider
                value={brushSize}
                onChange={setBrushSize}
                min={6}
                max={100}
                step={2}
                color="salmon"
                size="sm"
                styles={{
                  bar: { backgroundColor: "#fa8072" },
                  thumb: { borderColor: "#fa8072" },
                }}
              />
            </div>

            {/* Pengaturan Opacity Brush */}
            <div className={classes.sliderRow}>
              <div className={classes.sliderHeader}>
                <span>Opacity Tampilan</span>
                <span className={classes.sliderValue}>{Math.round(brushOpacity * 100)}%</span>
              </div>
              <Slider
                value={brushOpacity}
                onChange={setBrushOpacity}
                min={0.1}
                max={1.0}
                step={0.05}
                color="salmon"
                size="sm"
                styles={{
                  bar: { backgroundColor: "#fa8072" },
                  thumb: { borderColor: "#fa8072" },
                }}
              />
            </div>

            {/* Quick Actions: Undo, Redo, Clear */}
            <div>
              <div className={classes.sectionHeading}>Riwayat & Mask</div>
              <div className={classes.quickActionsRow}>
                <Button
                  variant="default"
                  size="xs"
                  className={classes.actionBtn}
                  disabled={!canUndo}
                  onClick={() => maskCanvasRef.current?.undo()}
                  leftSection={<UndoIcon size={13} />}
                >
                  Undo
                </Button>
                <Button
                  variant="default"
                  size="xs"
                  className={classes.actionBtn}
                  disabled={!canRedo}
                  onClick={() => maskCanvasRef.current?.redo()}
                  leftSection={<RedoIcon size={13} />}
                >
                  Redo
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  className={classes.actionBtn}
                  disabled={!hasMask && !canUndo}
                  onClick={() => maskCanvasRef.current?.clearMask()}
                  leftSection={<TrashIcon size={13} />}
                >
                  Hapus
                </Button>
              </div>
            </div>

            {/* Input Prompt Edit / Inpainting */}
            <Stack gap={6}>
              <div className={classes.sectionHeading}>Instruksi Edit (Prompt)</div>
              <Textarea
                placeholder="Contoh: ganti baju menjadi gaun merah, hilangkan objek kacamata, ubah latar belakang menjadi pantai..."
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.currentTarget.value)}
                className={classes.promptTextarea}
              />
            </Stack>

            {errorMsg ? <ErrorAlert message={errorMsg} /> : null}

            {successMsg ? (
              <Paper
                p="xs"
                radius="md"
                style={{
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                <Text size="xs" c="green.3" fw={500}>
                  {successMsg}
                </Text>
              </Paper>
            ) : null}
          </div>

          {/* Footer Submit */}
          <div className={classes.sidebarFooter}>
            <Button
              className={classes.submitBtn}
              size="md"
              fullWidth
              loading={isSubmitting}
              onClick={handleSubmit}
              leftSection={<SparkleIcon size={16} />}
            >
              Mulai Inpaint (10 Sparks)
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
