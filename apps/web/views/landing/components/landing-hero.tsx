"use client";

import { useState, useRef } from "react";
import classes from "./landing.module.css";

interface LandingHeroProps {
  onStartCreation: () => void;
  onScrollTo: (id: string) => void;
}


const TEMPLATE_CAROUSEL_CARDS = [
  {
    id: "logos",
    title: "Logos & Icons",
    image: "/dreamina/carousel-logos.webp",
  },
  {
    id: "video",
    title: "AI video generator",
    image: "/dreamina/carousel-video.webp",
  },
  {
    id: "trending",
    title: "Trending effects",
    image: "/dreamina/carousel-trending.webp",
  },
  {
    id: "photo",
    title: "AI photo editor",
    image: "/dreamina/carousel-photo.webp",
  },
  {
    id: "style",
    title: "Style transfer",
    image: "/dreamina/carousel-style.webp",
  },
  {
    id: "poster",
    title: "Poster design",
    image: "/dreamina/carousel-poster.webp",
  },
];

// 3 repeated sets for infinite continuous marquee scrolling
const ALL_CAROUSEL_CARDS = [
  ...TEMPLATE_CAROUSEL_CARDS,
  ...TEMPLATE_CAROUSEL_CARDS,
  ...TEMPLATE_CAROUSEL_CARDS,
];

export function LandingHero({
  onStartCreation,
  onScrollTo,
}: LandingHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const templateSectionRef = useRef<HTMLElement>(null);

  const handleSwipeDown = () => {
    if (templateSectionRef.current) {
      templateSectionRef.current.scrollIntoView({ behavior: "smooth" });
    } else {
      onScrollTo("video-ai");
    }
  };

  return (
    <>
      {/* ==================================================================
          WINDOW 1: Full-Screen Hero Video Banner
          With Swipe for more (Does NOT overlap with Carousel)
          ================================================================== */}
      <section id="hero-banner" className={classes.heroBannerWindow}>
        {/* Full-Screen Video Background */}
        <video
          ref={videoRef}
          className={classes.dreaminaBgVideo}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/dreamina/dreamina-hero-main.webp"
        >
          <source src="/dreamina/dreamina-hero-main.mp4" type="video/mp4" />
        </video>

        {/* Video Darkening Overlay */}
        <div className={classes.dreaminaVideoOverlay} />

        {/* Center/Left Content: Layout matching reference screenshot */}
        <div className={classes.heroCenterContent}>
          {/* Heading */}
          <h1 className={classes.heroGiantTitle}>
            Create Without
            <br />
            Limits
          </h1>

          {/* Subtitle */}
          <p className={classes.heroSubtitleText}>
            Platform studio AI video dan photo
            <br />
            untuk kamu yang ingin kebebasan kreasi sesungguhnya
          </p>

          {/* CTA Button with existing blue-purple gradient */}
          <button
            type="button"
            className={classes.heroGradientCtaBtn}
            onClick={onStartCreation}
          >
            <span>Coba Sekarang</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </button>
        </div>

        {/* Swipe down indicator — icon only, no background or border */}
        <div
          className={classes.swipeIndicator}
          onClick={handleSwipeDown}
          role="button"
          tabIndex={0}
          title="Scroll to templates"
        >
          <svg
            className={classes.swipeArrowIcon}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </div>
      </section>

      {/* ==================================================================
          WINDOW 2: Dedicated Template Showcase Window
          (Separate window with clean white background, NO overlap on Hero Video)
          ================================================================== */}
      <section
        id="dreamina-screen"
        ref={templateSectionRef}
        className={classes.templateShowcaseWindow}
      >
        {/* Top Header */}
        <div className={classes.templateWindowHeader}>
          <h2 className={classes.templateTitleHeading}>
            <span className={classes.templateTitleLine1}>
              Start with a Template.
            </span>
            <span className={classes.templateTitleLine2}>
              Make <span className={classes.templateItalicWord}>Anything</span>, Any Style with AI
            </span>
          </h2>
        </div>

        {/* Center: Running Marquee Carousel */}
        <div className={classes.carouselStage}>
          <div className={classes.carouselTrackWrapper}>
            <div className={classes.carouselTrack}>
              {ALL_CAROUSEL_CARDS.map((card, idx) => (
                <div
                  key={`${card.id}-${idx}`}
                  className={classes.templateCard}
                  onClick={onStartCreation}
                >
                  <img
                    src={card.image}
                    alt={card.title}
                    className={classes.templateCardImg}
                    loading="lazy"
                    draggable={false}
                  />
                  <div className={classes.templateCardTopGradient} />
                  <div className={classes.templateCardHeader}>
                    <span className={classes.templateCardTitle}>
                      {card.title}
                    </span>
                    <button
                      type="button"
                      className={classes.tryNowBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartCreation();
                      }}
                    >
                      Try now
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 17L17 7M17 7H7M17 7V17" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
