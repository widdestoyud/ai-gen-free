"use client";

import { Text } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { getProgressMessage, getProgressStageKey } from "@/lib/progress-messages";
import classes from "./generate-studio.module.css";

function parseAspectRatio(ratioStr: string): { w: number; h: number; ratio: number } {
  if (!ratioStr || typeof ratioStr !== "string") return { w: 1, h: 1, ratio: 1 };
  const parts = ratioStr.split(":").map((p) => parseFloat(p.trim()));
  if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!) && parts[1]! > 0) {
    return { w: parts[0]!, h: parts[1]!, ratio: parts[0]! / parts[1]! };
  }
  return { w: 1, h: 1, ratio: 1 };
}

export function GenerateSkeleton({
  aspectRatio = "1:1",
  progress,
}: {
  aspectRatio: string;
  progress?: number;
  mediaType?: "image" | "video";
}) {
  const [fakeProgress, setFakeProgress] = useState(12);
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * 20));
  const prevStageRef = useRef<string>("10");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { w: ratioW, h: ratioH, ratio: ratioMultiplier } = parseAspectRatio(aspectRatio);

  // Smooth fake progress progression
  useEffect(() => {
    if (typeof progress === "number" && progress > 0) return;
    const interval = window.setInterval(() => {
      setFakeProgress((prev) => {
        if (prev >= 92) return prev;
        const jump = Math.floor(Math.random() * 5) + 2;
        return Math.min(prev + jump, 92);
      });
    }, 1200);
    return () => window.clearInterval(interval);
  }, [progress]);

  const progressVal = typeof progress === "number" && progress > 0 ? progress : fakeProgress;
  const currentStage = getProgressStageKey(progressVal);

  useEffect(() => {
    if (prevStageRef.current !== currentStage) {
      prevStageRef.current = currentStage;
      setMsgIndex(Math.floor(Math.random() * 20));
    }
  }, [currentStage]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % 20);
    }, 3800);
    return () => window.clearInterval(interval);
  }, []);

  // Canvas Interactive Ripple Wave simulation with small white squares (HD & 4K optimized)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    const CELL_SIZE = 12;
    let width = 478;
    let height = 478;
    let cols = Math.floor(width / CELL_SIZE);
    let rows = Math.floor(height / CELL_SIZE);

    let buffer1 = new Float32Array(cols * rows);
    let buffer2 = new Float32Array(cols * rows);

    const dropRipple = (centerX: number, centerY: number, strength = 220, radius = 2.5) => {
      const minC = Math.max(1, Math.floor(centerX - radius));
      const maxC = Math.min(cols - 2, Math.ceil(centerX + radius));
      const minR = Math.max(1, Math.floor(centerY - radius));
      const maxR = Math.min(rows - 2, Math.ceil(centerY + radius));

      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const dx = c - centerX;
          const dy = r - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            const idx = r * cols + c;
            buffer1[idx] = (buffer1[idx] ?? 0) + strength * (1 - dist / (radius + 0.1));
          }
        }
      }
    };

    const updateDimensions = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      width = Math.max(rect.width, 180);
      height = Math.max(rect.height, 180);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      cols = Math.floor(width / CELL_SIZE);
      rows = Math.floor(height / CELL_SIZE);
      buffer1 = new Float32Array(cols * rows);
      buffer2 = new Float32Array(cols * rows);

      // Initial center ripple
      dropRipple(cols / 2, rows / 2, 400, 3);
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.observe(canvas);

    // Mouse / pointer movement tracking
    let lastX = -1;
    let lastY = -1;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        const gridX = (x / rect.width) * cols;
        const gridY = (y / rect.height) * rows;

        if (lastX >= 0 && lastY >= 0) {
          const dist = Math.hypot(gridX - lastX, gridY - lastY);
          const steps = Math.min(Math.max(1, Math.floor(dist)), 5);
          for (let s = 1; s <= steps; s++) {
            const ix = lastX + ((gridX - lastX) * s) / steps;
            const iy = lastY + ((gridY - lastY) * s) / steps;
            dropRipple(ix, iy, 180, 2.2);
          }
        } else {
          dropRipple(gridX, gridY, 220, 2.5);
        }

        lastX = gridX;
        lastY = gridY;
      }
    };

    const handlePointerLeave = () => {
      lastX = -1;
      lastY = -1;
    };

    const targetElement = canvas.parentElement || canvas;
    targetElement.addEventListener("pointermove", handlePointerMove, { passive: true });
    targetElement.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    let lastAmbientDrop = performance.now();
    const damping = 0.965;

    const render = () => {
      const now = performance.now();

      // Ambient periodic ripple
      if (now - lastAmbientDrop > 2800) {
        lastAmbientDrop = now;
        const rx = 4 + Math.random() * (cols - 8);
        const ry = 4 + Math.random() * (rows - 8);
        dropRipple(rx, ry, 150, 2.0);
      }

      // Step wave equation
      for (let r = 1; r < rows - 1; r++) {
        const rOffset = r * cols;
        for (let c = 1; c < cols - 1; c++) {
          const idx = rOffset + c;
          buffer2[idx] =
            ((buffer1[idx - 1] ?? 0) +
              (buffer1[idx + 1] ?? 0) +
              (buffer1[idx - cols] ?? 0) +
              (buffer1[idx + cols] ?? 0)) /
              2 -
            (buffer2[idx] ?? 0);
          buffer2[idx] = (buffer2[idx] ?? 0) * damping;
        }
      }

      // Swap buffers
      const temp = buffer1;
      buffer1 = buffer2;
      buffer2 = temp;

      // Fill background with #424242
      ctx.fillStyle = "#424242";
      ctx.fillRect(0, 0, width, height);

      // Render small white square pixels with wave response
      for (let r = 0; r < rows; r++) {
        const rOffset = r * cols;
        const cy = r * CELL_SIZE + CELL_SIZE / 2;
        for (let c = 0; c < cols; c++) {
          const idx = rOffset + c;
          const cx = c * CELL_SIZE + CELL_SIZE / 2;
          const wave = Math.abs(buffer1[idx] ?? 0);

          const alpha = Math.min(1.0, 0.16 + wave * 0.007);
          const size = Math.min(4.4, 2.2 + wave * 0.015);

          ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
          ctx.fillRect(
            cx - size / 2,
            cy - size / 2,
            size,
            size
          );
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      targetElement.removeEventListener("pointermove", handlePointerMove);
      targetElement.removeEventListener("pointerleave", handlePointerLeave);
      resizeObserver.disconnect();
    };
  }, []);

  const activeMessage = getProgressMessage(progressVal, msgIndex);

  return (
    <div data-fal-mv-react-root="" className={`${classes.falMvRoot} flex max-h-full max-w-full items-center justify-center f-html`}>
      <div
        className={`${classes.falMvContainer} overflow-hidden rounded border border-stroke-light bg-surface-200`}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <div
          aria-label="Generating..."
          className={`${classes.falMvStatus} relative flex h-full w-full items-center justify-center overflow-hidden bg-transparent text-content-light contain-paint`}
          role="status"
        >
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`${classes.falMvCanvas} block h-full min-h-0 w-full min-w-0`}
            width={478}
            height={478}
          />

          {/* Overlay Progress UI: Persentase + Slide-in-up Text */}
          <div className={classes.falMvOverlay}>
            <div className={classes.skeletonProgressContainer}>
              <div className={classes.skeletonPercentText}>
                {Math.round(progressVal)}%
              </div>

              <div className={classes.skeletonMessageWrapper}>
                <div key={activeMessage} className={classes.skeletonSlideInText}>
                  <Text size="sm" ta="center" className={classes.skeletonMessageContent}>
                    {activeMessage}
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


