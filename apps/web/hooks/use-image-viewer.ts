"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export const ZOOM_LEVELS = [100, 125, 150, 175, 200, 250, 300] as const;

export function useImageViewer(options?: { resetKey?: unknown }) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const panRef = useRef({ x: 0, y: 0 });
  const zoomLevelRef = useRef(100);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initialPanX: 0, initialPanY: 0 });
  const rafIdRef = useRef<number | null>(null);

  const zoomLevel = ZOOM_LEVELS[zoomIndex] ?? 100;
  zoomLevelRef.current = zoomLevel;
  const isZoomed = zoomIndex > 0;

  const applyDirectTransform = useCallback((immediate = false) => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    const scale = zoomLevelRef.current / 100;
    const { x, y } = panRef.current;

    if (immediate) {
      img.style.transition = "none";
    } else {
      img.style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
    }

    img.style.transform = `translate3d(${x}px, ${y}px, 0px) scale(${scale})`;
  }, []);

  const resetZoom = useCallback(() => {
    setZoomIndex(0);
    zoomLevelRef.current = 100;
    panRef.current = { x: 0, y: 0 };
    applyDirectTransform(false);
  }, [applyDirectTransform]);

  // Reset when key changes
  useEffect(() => {
    resetZoom();
  }, [options?.resetKey, resetZoom]);

  // Sync transform when zoomLevel changes
  useEffect(() => {
    if (zoomIndex === 0) {
      panRef.current = { x: 0, y: 0 };
    }
    applyDirectTransform(false);
  }, [zoomIndex, applyDirectTransform]);

  const zoomIn = useCallback(() => {
    setZoomIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      if (next === 0) {
        panRef.current = { x: 0, y: 0 };
      }
      return next;
    });
  }, []);

  const toggleZoom = useCallback(() => {
    setZoomIndex((prev) => (prev > 0 ? 0 : 3)); // Toggle between 100% and 175%
  }, []);

  // Global Pointer Dragging with requestAnimationFrame (60-120fps hardware accelerated)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (zoomIndex === 0) return;
      if (e.button !== 0) return; // Only primary button
      e.preventDefault();

      isDraggingRef.current = true;
      setIsDragging(true);

      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        initialPanX: panRef.current.x,
        initialPanY: panRef.current.y,
      };

      if (imageRef.current) {
        imageRef.current.style.transition = "none";
      }

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!isDraggingRef.current) return;
        const deltaX = moveEvent.clientX - dragStartRef.current.mouseX;
        const deltaY = moveEvent.clientY - dragStartRef.current.mouseY;

        panRef.current = {
          x: dragStartRef.current.initialPanX + deltaX,
          y: dragStartRef.current.initialPanY + deltaY,
        };

        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          if (!imageRef.current) return;
          const scale = zoomLevelRef.current / 100;
          imageRef.current.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0px) scale(${scale})`;
        });
      };

      const onPointerUp = () => {
        isDraggingRef.current = false;
        setIsDragging(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [zoomIndex]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else if (e.deltaY > 0) {
        zoomOut();
      }
    },
    [zoomIn, zoomOut]
  );

  return {
    containerRef,
    imageRef,
    zoomIndex,
    zoomLevel,
    isZoomed,
    isDragging,
    canZoomIn: zoomIndex < ZOOM_LEVELS.length - 1,
    canZoomOut: zoomIndex > 0,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleZoom,
    viewerProps: {
      onPointerDown: handlePointerDown,
      onWheel: handleWheel,
      onDoubleClick: toggleZoom,
    },
  };
}
