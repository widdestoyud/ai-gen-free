"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import classes from "./landing.module.css";

interface LandingHeaderProps {
  onOpenLogin: () => void;
  onStartCreation: () => void;
  onScrollTo?: (id: string) => void;
}

export function LandingHeader({
  onOpenLogin,
  onStartCreation,
}: LandingHeaderProps) {
  const { t } = useI18n("nav");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`${classes.dreaminaHeader} ${
        scrolled ? classes.dreaminaHeaderScrolled : ""
      }`}
    >
      {/* Brand Logo */}
      <div
        className={classes.brandLogo}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <div className={classes.brandIconWrapper}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" />
          </svg>
        </div>
        <span style={{ fontWeight: 800, fontSize: "1.25rem", color: "#ffffff" }}>
          satulabs<span className={classes.brandDot}>.id</span>
        </span>
      </div>

      {/* Right Group: Language Switcher, Sign In, Coba Sekarang (Register Modal) */}
      <div className={classes.headerRightGroup}>
        <LanguageSwitcher />

        <button
          type="button"
          className={classes.signInBtn}
          onClick={onOpenLogin}
          aria-label={t("login")}
        >
          {t("login")}
        </button>

        <button
          type="button"
          className={classes.createNowBtn}
          onClick={onStartCreation}
          aria-label={t("try_free")}
        >
          {t("try_free")}
        </button>
      </div>
    </header>
  );
}
