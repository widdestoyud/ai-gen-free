"use client";

import { useState, useCallback } from "react";
import { useLogin } from "./use-login";
import { useRegister } from "./use-register";
import { useForgotPassword } from "./use-forgot-password";

export type PreviewTab = "image" | "video" | "prompt";

export function useLandingPage() {
  const login = useLogin();
  const register = useRegister();
  const forgotPassword = useForgotPassword();
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

  const handleOpenForgotPassword = useCallback(() => {
    login.closeLogin();
    forgotPassword.openForgotPassword(login.email);
  }, [login, forgotPassword]);

  const handleBackToLoginFromForgot = useCallback(() => {
    forgotPassword.closeForgotPassword();
    login.openLogin();
    if (forgotPassword.email) {
      login.setEmail(forgotPassword.email);
    }
  }, [login, forgotPassword]);

  return {
    login,
    register,
    forgotPassword,
    activePreview,
    setActivePreview,
    scrollToSection,
    handleStartCreation,
    handleOpenLogin,
    handleOpenForgotPassword,
    handleBackToLoginFromForgot,
  };
}
