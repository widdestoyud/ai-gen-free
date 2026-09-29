"use client";

import { useState, useMemo } from "react";
import { Container } from "@mantine/core";
import classes from "./landing.module.css";

interface LandingModelsProps {
  onStartCreation?: () => void;
}

type FilterTag = "all" | "image" | "video";

interface InspirationItem {
  id: string;
  type: "image" | "video";
  title: string;
  author: string;
  image: string;
  video?: string;
  poster?: string;
  heightRatio?: number; // ratio for masonry look
  prompt?: string;
}

const INSPIRATION_ITEMS: InspirationItem[] = [
  {
    id: "1",
    type: "image",
    title: "Punk Rebel by Nature",
    author: "Lumina",
    image: "/lumina/lumina-punk.webp",
    prompt: "Punk Rebel by Nature magazine cover, high fashion editorial, cool lighting, grain texture",
  },
  {
    id: "2",
    type: "image",
    title: "Cheers Champagne Celebration",
    author: "Lumina",
    image: "/lumina/lumina-cheers.webp",
    prompt: "Celebration cheers with champagne glasses, outdoor sunlight, luxury aesthetic, ultra high resolution",
  },
  {
    id: "3",
    type: "image",
    title: "Cute Teddy Bear in Garden",
    author: "Lumina",
    image: "/lumina/lumina-bear.webp",
    prompt: "Adorable plush teddy bear sitting in sunny flower meadow, soft natural lighting, shallow depth of field",
  },
  {
    id: "4",
    type: "image",
    title: "Steamed Fish Gourmet Platter",
    author: "Lumina",
    image: "/lumina/lumina-fish.webp",
    prompt: "Gourmet steamed fish with chili herbs on ceramic plate, cinematic commercial culinary photo 8K",
  },
  {
    id: "5",
    type: "image",
    title: "Focus Mind Over Matter",
    author: "Lumina",
    image: "/lumina/lumina-focus.webp",
    prompt: "Editorial magazine cover 'FOCUS', handsome male model with headphones, bold typography, studio portrait",
  },
  {
    id: "6",
    type: "image",
    title: "The Lily Boat Fantasy",
    author: "Lumina",
    image: "/lumina/lumina-lilyboat.webp",
    prompt: "Vintage fairytale girl in a floral wooden boat surrounded by water lilies, pastel oil painting vibe",
  },
  {
    id: "7",
    type: "image",
    title: "Minimalist Geometric Fish Art",
    author: "Lumina",
    image: "/lumina/lumina-fishart.webp",
    prompt: "Japanese minimalist graphic art poster of a fish, earth tones, textured paper, modern exhibition design",
  },
  {
    id: "8",
    type: "image",
    title: "Red Overlay Geek Fashion",
    author: "Lumina",
    image: "/lumina/lumina-redoverlay.webp",
    prompt: "Futuristic cyberpunk fashion with red sunglasses and cyber typography, avant-garde editorial",
  },
  {
    id: "9",
    type: "image",
    title: "Vogue Life in Pastels",
    author: "Lumina",
    image: "/lumina/lumina-vogue.webp",
    prompt: "Vogue magazine cover, beautiful female model holding crystal pegasus, pastel makeup, ethereal lighting",
  },
  {
    id: "10",
    type: "image",
    title: "Lick Mao Pink Velvet Ice Cream",
    author: "Lumina",
    image: "/lumina/lumina-icecream.webp",
    prompt: "Pink silk glove holding velvet strawberry ice cream cone, glamorous beauty product photography",
  },
  {
    id: "11",
    type: "video",
    title: "Cinematic Nightclub Portrait",
    author: "Lumina",
    image: "/dreamina/video-sd25-1.webp",
    video: "/dreamina/video-sd25-1.mp4",
    poster: "/dreamina/video-sd25-1.webp",
    prompt: "4K cinematic slow-motion neon nightclub portrait, volumetric lighting, realistic skin texture",
  },
  {
    id: "12",
    type: "video",
    title: "Dynamic Combat Action",
    author: "Lumina",
    image: "/dreamina/video-sd25-4.webp",
    video: "/dreamina/video-sd25-4.mp4",
    poster: "/dreamina/video-sd25-4.webp",
    prompt: "Intense close-quarters cinematic combat action sequence, handheld camera style, gritty texture",
  },
];

export function LandingModels({ onStartCreation }: LandingModelsProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTag>("all");

  const filteredItems = useMemo(() => {
    return INSPIRATION_ITEMS.filter((item) => {
      return activeFilter === "all" || item.type === activeFilter;
    });
  }, [activeFilter]);

  return (
    <section className={classes.inspirationSection} id="video-ai">
      <Container size="xl">
        <div className="relative z-10">
          <div className="mb-[20px]">
            {/* Header: Inspiration Title */}
            <div className="mb-[16px] flex justify-between items-start md:items-center">
              <div>
                <h2
                  id="lumina-inspiration-heading"
                  className="m-0 mb-[4px] font-[600] text-[28px] leading-[35px] text-[rgba(255,255,255,1)]"
                  style={{ fontSize: "28px", fontWeight: 600, color: "#ffffff", margin: "0 0 4px 0" }}
                >
                  Inspiration
                </h2>
                <div
                  className="text-[12px] leading-[15px] text-[rgba(255,255,255,0.55)]"
                  style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)" }}
                >
                  Fresh inspiration tailored for you
                </div>
              </div>
            </div>

            {/* Tags: All / Image / Video */}
            <div className={classes.luminaTagsList}>
              <button
                type="button"
                className={`${classes.luminaTag} ${
                  activeFilter === "all" ? classes.luminaTagSelected : ""
                }`}
                onClick={() => setActiveFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`${classes.luminaTag} ${
                  activeFilter === "image" ? classes.luminaTagSelected : ""
                }`}
                onClick={() => setActiveFilter("image")}
                id="image-ai"
              >
                Image
              </button>
              <button
                type="button"
                className={`${classes.luminaTag} ${
                  activeFilter === "video" ? classes.luminaTagSelected : ""
                }`}
                onClick={() => setActiveFilter("video")}
              >
                Video
              </button>
            </div>
          </div>

          {/* Masonry / Waterfall Gallery Grid */}
          <div className={classes.luminaMasonryGrid}>
            {filteredItems.map((item) => (
              <div key={item.id} className={classes.luminaFragmentCard}>
                <div
                  className={classes.luminaCardCover}
                  role="button"
                  tabIndex={0}
                  aria-label="View Details"
                  onClick={onStartCreation}
                >
                  {item.video ? (
                    <video
                      src={item.video}
                      poster={item.poster || item.image}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      className={classes.luminaCardMedia}
                    />
                  ) : (
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className={classes.luminaCardMedia}
                    />
                  )}

                  {/* AI Badge at top left */}
                  <span className={classes.luminaAiBadge}>AI</span>

                  {/* Hover Overlay with Action Buttons */}
                  <div className={classes.luminaCardHoverOverlay}>
                    <div className={classes.luminaCardFooterRow}>
                      <div className={classes.luminaCardUser}>
                        <span className={classes.luminaCardUsername}>
                          {item.author}
                        </span>
                      </div>

                      <div className={classes.luminaCardActions}>
                        {/* Bookmark / Star Button */}
                        <button
                          className={classes.luminaIconBtn}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartCreation?.();
                          }}
                          title="Like"
                          aria-label="Like"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 16 16"
                            width="14"
                            height="14"
                          >
                            <path
                              fill="#fff"
                              fillOpacity="0.85"
                              fillRule="evenodd"
                              d="M7.57 1.183a1 1 0 0 1 .86 0c.236.113.365.307.43.414.069.11.138.251.206.389l.01.02 1.427 2.891 3.214.47c.152.022.307.045.433.075.122.03.347.093.526.282a1 1 0 0 1 .266.819 1.04 1.04 0 0 1-.26.537c-.085.098-.198.208-.307.314L12.05 9.66l.548 3.199c.026.15.053.306.063.435.01.125.02.359-.105.588a1 1 0 0 1-.696.506 1.04 1.04 0 0 1-.592-.082c-.12-.05-.259-.123-.394-.194L8 12.599l-2.874 1.512a5 5 0 0 1-.394.194 1.04 1.04 0 0 1-.592.082 1 1 0 0 1-.696-.506 1.04 1.04 0 0 1-.105-.588c.01-.13.037-.284.063-.435l.548-3.199-2.308-2.248-.017-.017a5 5 0 0 1-.306-.314 1.04 1.04 0 0 1-.261-.537 1 1 0 0 1 .265-.819c.18-.19.405-.253.527-.282.126-.03.281-.053.432-.075l.024-.003 3.191-.467 1.427-2.89.01-.021c.068-.138.137-.278.205-.389a1.04 1.04 0 0 1 .43-.414M8 2.84 6.662 5.55l-.009.018c-.032.066-.098.202-.202.314a1 1 0 0 1-.31.226c-.14.065-.29.086-.362.096l-.02.002-2.993.438L4.93 8.753l.014.014c.053.05.163.155.237.29a1 1 0 0 1 .12.365 1.3 1.3 0 0 1-.026.393l-.51 2.979 2.675-1.407.018-.01c.065-.034.198-.106.349-.136q.192-.036.384 0c.151.03.284.102.349.136l.018.01 2.676 1.407-.511-2.979-.004-.02c-.013-.071-.04-.22-.021-.373a1 1 0 0 1 .119-.366c.074-.134.184-.239.237-.29l.014-.013 2.165-2.11-2.993-.437-.02-.002c-.072-.01-.222-.03-.361-.096a1 1 0 0 1-.311-.226c-.105-.112-.17-.248-.202-.314l-.009-.018z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>

                        {/* Prompt Re-create Button (Magic Wand / Layers) */}
                        <button
                          className={classes.luminaPromptActionBtn}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartCreation?.();
                          }}
                          title="Use Prompt"
                          aria-label="Use Prompt"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 18 18"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M6.20068 16.0691C7.41687 15.8114 8.9888 15.4783 10.2143 15.2187C11.2948 14.9897 11.9845 13.9287 11.7556 12.8481C11.5857 12.0463 11.3929 11.1362 11.2373 10.402M6.20068 16.0691C5.93304 16.1258 5.62912 16.1902 5.32211 16.2552C4.24153 16.4842 3.1799 15.7938 2.95095 14.7132L1.91456 9.8218C1.6856 8.74122 2.37598 7.67963 3.45656 7.45068L8.34798 6.41428C9.42856 6.18533 10.4901 6.87533 10.719 7.95591C10.8889 8.75769 11.0817 9.66775 11.2373 10.402M6.20068 16.0691C6 12.3748 7.875 10.8748 11.2373 10.402"
                              stroke="white"
                              strokeOpacity="0.85"
                              strokeWidth="1.5"
                            />
                            <circle
                              cx="4.5"
                              cy="10"
                              r="0.75"
                              fill="white"
                              fillOpacity="0.85"
                            />
                            <path
                              d="M15.5263 0.973775C15.6485 0.799516 15.9215 0.871217 15.9422 1.08299L16.0793 2.48415C16.1011 2.70609 16.2187 2.90746 16.4013 3.03544L17.5542 3.84339C17.7285 3.96551 17.6568 4.23851 17.445 4.25924L16.0438 4.39638C15.8219 4.4181 15.6205 4.5357 15.4925 4.71832L14.6846 5.87125C14.5625 6.04551 14.2895 5.97381 14.2687 5.76203L14.1316 4.36088C14.1099 4.13894 13.9923 3.93757 13.8097 3.80959L12.6567 3.00163C12.4825 2.87951 12.5542 2.60651 12.7659 2.58579L14.1671 2.44864C14.389 2.42692 14.5904 2.30932 14.7184 2.1267L15.5263 0.973775Z"
                              fill="white"
                              fillOpacity="0.85"
                            />
                          </svg>
                        </button>

                        {/* More (Dots) Button */}
                        <button
                          className={classes.luminaIconBtn}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartCreation?.();
                          }}
                          title="More options"
                          aria-label="More options"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M3 12C3 10.8954 3.89543 10 5 10C6.10457 10 7 10.8954 7 12C7 13.1046 6.10457 14 5 14C3.89543 14 3 13.1046 3 12ZM10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12ZM17 12C17 10.8954 17.8954 10 19 10C20.1046 10 21 10.8954 21 12C21 13.1046 20.1046 14 19 14C17.8954 14 17 13.1046 17 12Z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
