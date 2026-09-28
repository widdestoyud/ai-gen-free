"use client";

import { Container, Title, Text, Button, Group } from "@mantine/core";
import classes from "./landing.module.css";

interface LandingDreaminaGalleryProps {
  onStartCreation?: () => void;
}

const GALLERY_ITEMS = [
  {
    image: "/dreamina/gallery-1.webp",
    tag: "PRODUK KOMERSIAL",
    prompt: "Luxury cosmetic bottle with translucent serum droplets and soft natural studio sunlight.",
  },
  {
    image: "/dreamina/gallery-2.webp",
    tag: "EDITORIAL FASHION",
    prompt: "Avant-garde haute couture model in futuristic metallic fabrics with high-contrast strobe lighting.",
  },
  {
    image: "/dreamina/gallery-3.webp",
    tag: "3D CHARACTER ART",
    prompt: "Stylized 3D cinematic character with subsurface scattering skin and neon rim reflections.",
  },
  {
    image: "/dreamina/gallery-4.webp",
    tag: "CINEMATIC SCENERY",
    prompt: "Ethereal misty mountain valley with twilight aurora glow and reflective lake surface.",
  },
  {
    image: "/dreamina/gallery-5.webp",
    tag: "ANIME VISUAL",
    prompt: "Detailed anime key visual of a student looking at an azure sky filled with floating clouds.",
  },
  {
    image: "/dreamina/gallery-6.webp",
    tag: "CYBERPUNK CITY",
    prompt: "Dystopian city street illuminated by towering holographic advertisements and wet reflections.",
  },
  {
    image: "/dreamina/gallery-7.webp",
    tag: "ARSITEKTUR & INTERIOR",
    prompt: "Modern minimalist living space with floor-to-ceiling glass overlooking lush forest greenery.",
  },
  {
    image: "/dreamina/gallery-8.webp",
    tag: "SURREAL ART",
    prompt: "Surrealistic dreamscape with floating celestial objects and golden hour illumination.",
  },
];

export function LandingDreaminaGallery({ onStartCreation }: LandingDreaminaGalleryProps) {
  return (
    <section className={classes.spotlightSection}>
      <Container size="xl">
        <div className={classes.sectionHeader}>
          <span className={classes.sectionTag}>GALERI KOMUNITAS &amp; KREATOR</span>
          <Title className={classes.sectionTitle} order={2}>
            Lihat yang Diciptakan Kreator Lain.
            <br />
            <span className={classes.heroTitleHighlight}>
              Imajinasi Tanpa Batas dengan AI.
            </span>
          </Title>
          <Text className={classes.sectionSubtitle}>
            Dari materi katalog jualan, visual promosi brand ternama, hingga karya seni sinematik.
            Setiap karya bermula dari sebuah ide dan kalimat sederhana.
          </Text>
        </div>

        <div className={classes.galleryGrid}>
          {GALLERY_ITEMS.map((item, idx) => (
            <div
              key={`${item.tag}-${idx}`}
              className={classes.galleryCard}
              onClick={onStartCreation}
            >
              <img src={item.image} alt={item.prompt} loading="lazy" />
              <div className={classes.galleryCardOverlay}>
                <span className={classes.galleryCardTag}>{item.tag}</span>
                <p className={classes.galleryCardPrompt}>&ldquo;{item.prompt}&rdquo;</p>
              </div>
            </div>
          ))}
        </div>

        <Group justify="center" mt={48}>
          <Button
            size="lg"
            className={classes.headerBtnGlow}
            radius="md"
            onClick={onStartCreation}
            leftSection={
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
                <path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" />
              </svg>
            }
          >
            Mulai Buat Karyamu Sendiri
          </Button>
        </Group>
      </Container>
    </section>
  );
}
