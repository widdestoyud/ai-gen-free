"use client";

import { Container, Group, Button, Text } from "@mantine/core";
import classes from "./landing.module.css";

interface LandingHeaderProps {
  onOpenLogin: () => void;
  onStartCreation: () => void;
  onScrollTo: (id: string) => void;
}

export function LandingHeader({
  onOpenLogin,
  onStartCreation,
  onScrollTo,
}: LandingHeaderProps) {
  return (
    <header className={classes.header}>
      <Container size="lg" className={classes.headerInner}>
        <div
          className={classes.brandLogo}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" />
          </svg>
          <Text span fw={800}>
            ai-gen-free<span className={classes.brandDot}>.</span>
          </Text>
        </div>

        <Group gap="xl" visibleFrom="sm">
          <span className={classes.navLink} onClick={() => onScrollTo("fitur")}>
            Fitur
          </span>
          <span className={classes.navLink} onClick={() => onScrollTo("privasi")}>
            Privasi
          </span>
          <span className={classes.navLink} onClick={() => onScrollTo("keunggulan")}>
            Keunggulan
          </span>
          <span className={classes.navLink} onClick={() => onScrollTo("langkah")}>
            Cara Kerja
          </span>
          <span className={classes.navLink} onClick={() => onScrollTo("harga")}>
            Pilih Paket
          </span>
          <span className={classes.navLink} onClick={() => onScrollTo("faq")}>
            FAQ
          </span>
        </Group>

        <Group gap="xs">
          <Button variant="subtle" color="gray" onClick={onOpenLogin}>
            Masuk
          </Button>
          <Button variant="filled" color="blue" onClick={onStartCreation}>
            Mulai Berkarya
          </Button>
        </Group>
      </Container>
    </header>
  );
}
