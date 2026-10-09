"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import classes from "./image-compare-slider.module.css";

export interface ImageCompareSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  initialPosition?: number; // 0 to 100
  className?: string;
}

function DualArrowsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="8 7 3 12 8 17" />
      <polyline points="16 7 21 12 16 17" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

export function ImageCompareSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Original",
  afterLabel = "4x Upscaled",
  initialPosition = 50,
  className,
}: ImageCompareSliderProps) {
  const [sliderPos, setSliderPos] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const offsetX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    setSliderPos(percentage);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
      isDraggingRef.current = true;
      updatePosition(e.clientX);
    },
    [updatePosition]
  );

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      updatePosition(e.clientX);
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        setIsDragging(false);
        isDraggingRef.current = false;
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [updatePosition]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setSliderPos((prev) => Math.max(0, prev - 5));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setSliderPos((prev) => Math.min(100, prev + 5));
    } else if (e.key === "Home") {
      e.preventDefault();
      setSliderPos(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setSliderPos(100);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${classes.compareContainer} ${className ?? ""}`}
      data-dragging={isDragging ? "true" : undefined}
      onPointerDown={handlePointerDown}
      tabIndex={0}
      role="slider"
      aria-valuenow={Math.round(sliderPos)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Pembanding gambar sebelum dan sesudah upscale"
      onKeyDown={handleKeyDown}
    >
      {/* Layer 1 (Bawah): After / Upscaled Image */}
      <img
        src={afterUrl}
        alt={afterLabel}
        className={classes.compareBaseImage}
        draggable={false}
      />

      {/* Layer 2 (Atas): Before / Original Image dengan clip-path */}
      <img
        src={beforeUrl}
        alt={beforeLabel}
        className={classes.compareOverlayImage}
        style={{
          clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
        }}
        draggable={false}
      />

      {/* Garis Pemisah & Handle Geser */}
      <div
        className={classes.dividerLine}
        style={{ left: `${sliderPos}%` }}
      >
        <div className={classes.handleButton} aria-hidden="true">
          <DualArrowsIcon size={16} />
        </div>
      </div>

      {/* Label Indikator Before & After */}
      <div className={classes.badgeBefore}>
        {beforeLabel}
      </div>
      <div className={classes.badgeAfter}>
        {afterLabel}
      </div>
    </div>
  );
}
