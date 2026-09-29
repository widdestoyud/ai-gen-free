"use client";

import { useState, useEffect } from "react";
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

      {/* Right Group: Sign In, Create Now */}
      <div className={classes.headerRightGroup}>
        <button
          type="button"
          className={classes.signInBtn}
          onClick={onOpenLogin}
        >
          Masuk
        </button>

        <button
          type="button"
          className={classes.createNowBtn}
          onClick={onStartCreation}
        >
          Daftar
        </button>
      </div>
    </header>
  );
}
