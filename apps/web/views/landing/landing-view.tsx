"use client";

import { useRouter } from "next/navigation";
import { useLandingPage } from "@/hooks/use-landing-page";
import { LandingHeader } from "./components/landing-header";
import { LandingHero } from "./components/landing-hero";
import { LandingModels } from "./components/landing-models";
import { LandingFeatures } from "./components/landing-features";
import { LandingPrivacy } from "./components/landing-privacy";
import { LandingSteps } from "./components/landing-steps";
import { LandingPricing } from "./components/landing-pricing";
import { LandingFaq } from "./components/landing-faq";
import { LandingFooter } from "./components/landing-footer";
import { LoginModal } from "./components/login-modal";
import { RegisterModal } from "./components/register-modal";
import { ForgotPasswordModal } from "./components/forgot-password-modal";
import { OtpModal } from "@/components/otp-modal";
import type { PublicPackage } from "@/lib/server-api";
import classes from "./components/landing.module.css";

interface LandingPageViewProps {
  packages?: PublicPackage[];
}

export function LandingPageView({ packages }: LandingPageViewProps = {}) {
  const router = useRouter();
  const {
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
  } = useLandingPage();

  return (
    <div className={classes.wrapper}>
      <LandingHeader
        onOpenLogin={handleOpenLogin}
        onStartCreation={handleStartCreation}
        onScrollTo={scrollToSection}
      />

      <main>
        {/* Jumbotron Video Hero Section */}
        <LandingHero
          onStartCreation={handleStartCreation}
          onScrollTo={scrollToSection}
        />

        {/* Inspiration Showcase Gallery */}
        <LandingModels onStartCreation={handleStartCreation} />

        {/* Core Features & Workflow Bento Grid */}
        <LandingFeatures />

        {/* Privacy & Security Guarantee */}
        <LandingPrivacy />

        {/* 3 Simple Steps */}
        <LandingSteps />

        {/* Pricing Packages */}
        <LandingPricing
          packages={packages}
          onSelectPlan={(planId) => {
            router.push(`/checkout?packageId=${planId || "starter"}`);
          }}
        />

        {/* Frequently Asked Questions */}
        <LandingFaq />
      </main>

      <LandingFooter />

      {/* Auth Modals Controlled Declaratively */}
      <LoginModal
        opened={login.loginOpened}
        onClose={login.closeLogin}
        onForgotPassword={handleOpenForgotPassword}
        onRegister={handleOpenRegisterFromLogin}
        email={login.email}
        password={login.password}
        onEmailChange={login.setEmail}
        onPasswordChange={login.setPassword}
        error={login.otpModalOpened ? null : login.error}
        errorCode={login.otpModalOpened ? null : login.errorCode}
        transactionId={login.otpModalOpened ? null : login.transactionId}
        pending={login.pending && login.loginOpened}
        onSubmit={login.submitLogin}
      />

      <RegisterModal
        opened={register.opened}
        onClose={register.closeRegister}
        onLogin={handleOpenLoginFromRegister}
        email={register.email}
        password={register.password}
        onEmailChange={register.setEmail}
        onPasswordChange={register.setPassword}
        termsAccepted={register.termsAccepted}
        onTermsAcceptedChange={register.setTermsAccepted}
        success={register.success}
        error={register.error}
        errorCode={register.errorCode}
        transactionId={register.transactionId}
        pending={register.pending}
        onSubmit={register.submitRegister}
      />

      <ForgotPasswordModal
        opened={forgotPassword.opened}
        onClose={forgotPassword.closeForgotPassword}
        onBackToLogin={handleBackToLoginFromForgot}
        email={forgotPassword.email}
        onEmailChange={forgotPassword.setEmail}
        success={forgotPassword.success}
        error={forgotPassword.error}
        errorCode={forgotPassword.errorCode}
        transactionId={forgotPassword.transactionId}
        pending={forgotPassword.pending}
        onSubmit={forgotPassword.submitForgotPassword}
      />

      <OtpModal
        opened={login.otpModalOpened}
        onClose={login.closeOtpModal}
        email={login.email}
        code={login.code}
        onCodeChange={login.setCode}
        error={login.error}
        errorCode={login.errorCode}
        transactionId={login.transactionId}
        pending={login.pending && login.otpModalOpened}
        onSubmit={login.verifyCode}
        onResendOtp={login.resendOtp}
        resendPending={login.resendPending}
        resendCooldown={login.resendCooldown}
        resendSuccessMessage={login.resendSuccessMessage}
      />
    </div>
  );
}
