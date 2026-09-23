"use client";

import { useState, useCallback } from "react";
import { useLogin } from "./use-login";
import { useRegister } from "./use-register";

export type PreviewTab = "image" | "video" | "prompt";

export function useLandingPage() {
  const login = useLogin();
  const register = useRegister();
  const [activePreview, setActivePreview] = useState<PreviewTab>("image");

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const handleStartCreation = useCallback(() => {
    // Membuka modal daftar jika user baru, atau modal masuk
    register.openRegister();
  }, [register]);

  const handleOpenLogin = useCallback(() => {
    login.openLogin();
  }, [login]);

  return {
    login,
    register,
    activePreview,
    setActivePreview,
    scrollToSection,
    handleStartCreation,
    handleOpenLogin,
  };
}
