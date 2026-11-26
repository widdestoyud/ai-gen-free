"use client";

import type { CustomerTemplate } from "@/lib/template-apply";
import classes from "./template-card.module.css";

export interface TemplateCardProps {
  template: CustomerTemplate;
  revealed: boolean;
  onReveal: (id: string) => void;
  onTry: (template: CustomerTemplate) => void;
  tryLabel: string;
}

const MAX_VISIBLE_REFS = 3;

export function TemplateCard({
  template,
  revealed,
  onReveal,
  onTry,
  tryLabel,
}: TemplateCardProps) {
  const visibleRefs = template.images.slice(0, MAX_VISIBLE_REFS);
  const extraCount = Math.max(0, template.images.length - MAX_VISIBLE_REFS);

  const handleCardClick = () => {
    const isTouchOnly =
      typeof window !== "undefined" &&
      window.matchMedia("(hover: none)").matches;

    if (isTouchOnly) {
      if (!revealed) {
        onReveal(template.id);
      } else {
        onReveal("");
      }
      return;
    }

    onTry(template);
  };

  return (
    <article
      className={`${classes.card} ${revealed ? classes.cardRevealed : ""}`}
      onClick={handleCardClick}
    >
      <img
        src={template.coverUrl}
        alt={template.title}
        loading="lazy"
        decoding="async"
        className={classes.coverImage}
      />

      {visibleRefs.length > 0 ? (
        <div className={classes.refCluster} aria-hidden="true">
          {visibleRefs.map((img, idx) => (
            <div key={img.id} className={classes.refThumbItem}>
              <img
                src={img.url}
                alt={img.alias ?? `Referensi ${idx + 1}`}
                loading="lazy"
                decoding="async"
                className={classes.refThumbImg}
              />
            </div>
          ))}
          {extraCount > 0 ? (
            <span className={classes.refExtraChip}>+{extraCount}</span>
          ) : null}
        </div>
      ) : null}

      <div className={classes.overlay}>
        <button
          type="button"
          className={classes.tryButton}
          aria-label={`${tryLabel}: ${template.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onTry(template);
          }}
        >
          {tryLabel}
        </button>

        <p className={classes.titleCaption}>{template.title}</p>
      </div>
    </article>
  );
}
