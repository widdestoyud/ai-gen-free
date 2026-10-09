"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import classes from "./inpaint-editor.module.css";

export type ToolMode = "brush" | "eraser";

export type StrokePoint = {
  x: number;
  y: number;
};

export type Stroke = {
  mode: ToolMode;
  size: number;
  opacity: number;
  points: StrokePoint[];
};

export type MaskCanvasRef = {
  getMaskDataUrl: () => string | null;
  clearMask: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasMask: boolean;
};

type MaskCanvasProps = {
  imageUrl: string;
  toolMode: ToolMode;
  brushSize: number;
  brushOpacity: number;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean, hasMask: boolean) => void;
};

// Salmon red RGB constant: (250, 128, 114)
const SALMON_RED_RGB = "250, 128, 114";

export const MaskCanvas = forwardRef<MaskCanvasRef, MaskCanvasProps>(function MaskCanvas(
  { imageUrl, toolMode, brushSize, brushOpacity, onHistoryChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Stroke history for undo/redo
  const strokesRef = useRef<Stroke[]>([]);
  const redoStackRef = useRef<Stroke[]>([]);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Redraw visible canvas overlay from stroke history
  const redrawVisibleCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset visible canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = stroke.size;

      if (stroke.mode === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0, 0, 0, 1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = `rgba(${SALMON_RED_RGB}, ${stroke.opacity})`;
      }

      ctx.beginPath();
      const first = stroke.points[0]!;
      ctx.moveTo(first.x, first.y);

      if (stroke.points.length === 1) {
        ctx.lineTo(first.x, first.y + 0.1);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i]!;
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [imageLoaded]);

  const notifyHistory = useCallback(() => {
    if (onHistoryChange) {
      onHistoryChange(
        strokesRef.current.length > 0,
        redoStackRef.current.length > 0,
        strokesRef.current.some((s) => s.mode === "brush"),
      );
    }
  }, [onHistoryChange]);

  // Export black & white mask image (#000000 background, #ffffff masked area)
  const getMaskDataUrl = useCallback((): string | null => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !imageLoaded) return null;

    const nativeW = img.naturalWidth || canvas.width;
    const nativeH = img.naturalHeight || canvas.height;
    if (nativeW === 0 || nativeH === 0) return null;

    const scaleX = nativeW / canvas.width;
    const scaleY = nativeH / canvas.height;

    // Create offscreen canvas for black & white mask
    const offscreen = document.createElement("canvas");
    offscreen.width = nativeW;
    offscreen.height = nativeH;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return null;

    // 1. Fill entire background with pure black #000000 (unmodified region)
    offCtx.fillStyle = "#000000";
    offCtx.fillRect(0, 0, nativeW, nativeH);

    // 2. Draw all strokes in white #ffffff or black (eraser)
    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;

      offCtx.save();
      offCtx.lineCap = "round";
      offCtx.lineJoin = "round";
      // Scale stroke width to native image resolution
      offCtx.lineWidth = stroke.size * ((scaleX + scaleY) / 2);

      if (stroke.mode === "eraser") {
        offCtx.globalCompositeOperation = "source-over";
        offCtx.strokeStyle = "#000000";
      } else {
        offCtx.globalCompositeOperation = "source-over";
        offCtx.strokeStyle = "#ffffff";
      }

      offCtx.beginPath();
      const first = stroke.points[0]!;
      offCtx.moveTo(first.x * scaleX, first.y * scaleY);

      if (stroke.points.length === 1) {
        offCtx.lineTo(first.x * scaleX, first.y * scaleY + 0.1);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i]!;
          offCtx.lineTo(pt.x * scaleX, pt.y * scaleY);
        }
      }
      offCtx.stroke();
      offCtx.restore();
    }

    return offscreen.toDataURL("image/png");
  }, [imageLoaded]);

  const clearMask = useCallback(() => {
    strokesRef.current = [];
    redoStackRef.current = [];
    redrawVisibleCanvas();
    notifyHistory();
  }, [redrawVisibleCanvas, notifyHistory]);

  const undo = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    const popped = strokesRef.current.pop();
    if (popped) {
      redoStackRef.current.push(popped);
    }
    redrawVisibleCanvas();
    notifyHistory();
  }, [redrawVisibleCanvas, notifyHistory]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const popped = redoStackRef.current.pop();
    if (popped) {
      strokesRef.current.push(popped);
    }
    redrawVisibleCanvas();
    notifyHistory();
  }, [redrawVisibleCanvas, notifyHistory]);

  useImperativeHandle(
    ref,
    () => ({
      getMaskDataUrl,
      clearMask,
      undo,
      redo,
      canUndo: strokesRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
      hasMask: strokesRef.current.some((s) => s.mode === "brush"),
    }),
    [getMaskDataUrl, clearMask, undo, redo],
  );

  // Resize canvas overlay to match displayed image dimensions
  const syncCanvasSize = useCallback(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const rect = img.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawVisibleCanvas();
    }
  }, [redrawVisibleCanvas]);

  useEffect(() => {
    window.addEventListener("resize", syncCanvasSize);
    return () => window.removeEventListener("resize", syncCanvasSize);
  }, [syncCanvasSize]);

  // Pointer event handlers
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(canvas.height, e.clientY - rect.top)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left click
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    redoStackRef.current = []; // Clear redo stack on new action

    const pt = getCanvasCoords(e);
    const newStroke: Stroke = {
      mode: toolMode,
      size: brushSize,
      opacity: brushOpacity,
      points: [pt],
    };
    currentStrokeRef.current = newStroke;
    strokesRef.current.push(newStroke);

    redrawVisibleCanvas();
    notifyHistory();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(e);
    setCursorPos(pt);

    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    currentStrokeRef.current.points.push(pt);
    redrawVisibleCanvas();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
    try {
      if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
        canvasRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {}
    redrawVisibleCanvas();
    notifyHistory();
  };

  return (
    <div
      ref={containerRef}
      className={classes.canvasContainer}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => {
        setIsHovered(false);
        setCursorPos(null);
      }}
    >
      <div className={classes.canvasWrapper}>
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Inpaint Target"
          className={classes.baseImage}
          crossOrigin="anonymous"
          onLoad={() => {
            setImageLoaded(true);
            setTimeout(syncCanvasSize, 50);
          }}
        />

        <canvas
          ref={canvasRef}
          className={classes.maskCanvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Salmon Red Circular Brush Indicator Cursor */}
        {isHovered && cursorPos ? (
          <div
            className={toolMode === "eraser" ? classes.cursorEraserIndicator : classes.cursorIndicator}
            style={{
              left: `${cursorPos.x}px`,
              top: `${cursorPos.y}px`,
              width: `${brushSize}px`,
              height: `${brushSize}px`,
              opacity: toolMode === "eraser" ? 0.8 : Math.max(0.4, brushOpacity),
            }}
          />
        ) : null}
      </div>
    </div>
  );
});
