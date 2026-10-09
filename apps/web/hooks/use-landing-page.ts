"use client";

import { useCallback, useEffect } from "react";
import { useLogin } from "./use-login";
import { useRegister } from "./use-register";
import { useForgotPassword } from "./use-forgot-password";

export function useLandingPage() {
  const login = useLogin();
  const register = useRegister();
  const forgotPassword = useForgotPassword();

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Bersihkan URL dari parameter ?error=... pasca redirect OAuth error
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    const errMsg = params.get("message");
    const errCode = params.get("code");
    if (err) {
      window.history.replaceState({}, "", window.location.pathname);
      if (err !== "Configuration" && err !== "MissingCSRF") {
        login.openLogin();
        login.setError(errMsg || "Gagal masuk. Silakan coba lagi.");
        if (errCode) login.setErrorCode(errCode);
      }
    }

    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const timer = setTimeout(() => {
        scrollToSection(hash);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [scrollToSection, login]);

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

  const handleOpenRegisterFromLogin = useCallback(() => {
    const currentEmail = login.email;
    login.closeLogin();
    register.openRegister();
    if (currentEmail) {
      register.setEmail(currentEmail);
    }
  }, [login, register]);

  const handleOpenLoginFromRegister = useCallback(() => {
    const currentEmail = register.email;
    register.closeRegister();
    login.openLogin();
    if (currentEmail) {
      login.setEmail(currentEmail);
    }
  }, [login, register]);

  return {
    login,
    register,
    forgotPassword,
    scrollToSection,
    handleStartCreation,
    handleOpenLogin,
    handleOpenForgotPassword,
    handleBackToLoginFromForgot,
    handleOpenRegisterFromLogin,
    handleOpenLoginFromRegister,
  };
}
