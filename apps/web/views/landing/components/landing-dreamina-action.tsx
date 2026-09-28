"use client";

import { Container, Title, Text } from "@mantine/core";
import classes from "./landing.module.css";

interface LandingDreaminaActionProps {
  onStartCreation?: () => void;
}

const ACTION_VIDEOS = [
  {
    video: "/dreamina/video-action-1.mp4",
    poster: "/dreamina/video-action-1.webp",
    category: "CQC COMBAT & DYNAMICS",
    title: "Close-Quarters Combat & Physics Reaction",
    prompt:
      "Intense close-quarters combat (CQC) sequence. Subject: female agent in tactical winter gear engaging in hand-to-hand combat. Physics: visible shockwave ripple at point of impact, cold breath vapor visible, dynamic handheld camera.",
  },
  {
    video: "/dreamina/video-action-2.mp4",
    poster: "/dreamina/video-action-2.webp",
    category: "CONTINUOUS CAMERA LONG TAKE",
    title: "Fluid Motion Long Take with Camera Tracking",
    prompt:
      "Generate a cinematic large-scale action long take animation. Single continuous shot throughout, no cuts, fluid movements, clear weight, inertia, and landing cushioning, Makoto Shinkai lighting style.",
  },
  {
    video: "/dreamina/video-action-3.mp4",
    poster: "/dreamina/video-action-3.webp",
    category: "DRAMATIC LIGHTING & VFX",
    title: "Cinematic Chiaroscuro & Slow-Motion Explosion",
    prompt:
      "Epic cinematic video, slow-motion medium shot of a stoic western heroine, standing still while explosions burst in background, dramatic chiaroscuro lighting, gritty film texture, high contrast.",
  },
  {
    video: "/dreamina/video-action-4.mp4",
    poster: "/dreamina/video-action-4.webp",
    category: "DYNAMIC TRACKING & PACING",
    title: "Realistic Tracking Shot & Action Pacing",
    prompt:
      "Realistic style, snowy night. Close tracking shot at foot level, strong sense of speed, fast camera pan following dynamic movement with realistic physics and natural environment interaction.",
  },
];

export function LandingDreaminaAction({ onStartCreation }: LandingDreaminaActionProps) {
  return (
    <section className={classes.spotlightSectionDarker}>
      <Container size="xl">
        <div className={classes.sectionHeader}>
          <span className={classes.sectionTag}>ENGINE VIDEO SINEMATIK</span>
          <Title className={classes.sectionTitle} order={2}>
            Visual Storytelling Tanpa Batas.
            <br />
            <span className={classes.heroTitleHighlight}>
              Gerakan Halus 60fps &amp; Kontrol Kamera Sinematik.
            </span>
          </Title>
          <Text className={classes.sectionSubtitle}>
            Eksekusi adegan aksi rumit, pergerakan kamera dinamis (tracking shot, pan, zoom),
            dan efek pencahayaan sinematik langsung dari prompt teks sederhana.
          </Text>
        </div>

        <div className={classes.showcaseGrid4}>
          {ACTION_VIDEOS.map((item, idx) => (
            <div key={`${item.title}-${idx}`} className={classes.videoCardModern}>
              <div className={classes.videoCardMediaWrapperLandscape}>
                <video
                  src={item.video}
                  poster={item.poster}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
                <span className={classes.mediaBadgeEngine}>60fps Cine</span>
                <span className={classes.mediaBadgeDuration}>10s Ultra HD</span>
              </div>

              <div className={classes.videoCardInfo}>
                <div>
                  <Text size="xs" fw={700} c="violet.4" tt="uppercase" lts={1} mb={4}>
                    {item.category}
                  </Text>
                  <Text fw={700} size="sm" c="white" mb={8}>
                    {item.title}
                  </Text>
                  <p className={classes.promptTextSnippet}>
                    &ldquo;{item.prompt}&rdquo;
                  </p>
                </div>

                <div className={classes.cardBottomActions}>
                  <button
                    type="button"
                    className={classes.tryPromptBtn}
                    onClick={onStartCreation}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" />
                    </svg>
                    <span>Coba Gaya Ini</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
