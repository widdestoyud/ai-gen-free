"use client";

import { useLandingPage } from "@/hooks/use-landing-page";
import { LandingHeader } from "./components/landing-header";
import { LandingHero } from "./components/landing-hero";
import { LandingModels } from "./components/landing-models";
import { LandingPainPoints } from "./components/landing-pain-points";
import { LandingFeatures } from "./components/landing-features";
import { LandingPrivacy } from "./components/landing-privacy";
import { LandingSteps } from "./components/landing-steps";
import { LandingPricing } from "./components/landing-pricing";
import { LandingFaq } from "./components/landing-faq";
import { LandingCta } from "./components/landing-cta";
import { LandingFooter } from "./components/landing-footer";
import { LoginModal } from "./components/login-modal";
import { RegisterModal } from "./components/register-modal";
import { OtpModal } from "@/components/otp-modal";
import type { PublicPackage } from "@/lib/server-api";
import classes from "./components/landing.module.css";

interface LandingPageViewProps {
  packages?: PublicPackage[];
}

export function LandingPageView({ packages }: LandingPageViewProps = {}) {
  const {
    login,
    register,
    activePreview,
    setActivePreview,
    scrollToSection,
    handleStartCreation,
    handleOpenLogin,
  } = useLandingPage();

  return (
    <div className={classes.wrapper}>
      <LandingHeader
        onOpenLogin={handleOpenLogin}
        onStartCreation={handleStartCreation}
        onScrollTo={scrollToSection}
      />

      <main>
        <LandingHero
          onStartCreation={handleStartCreation}
          onScrollTo={scrollToSection}
          activePreview={activePreview}
          onSelectPreview={setActivePreview}
        />

        <LandingModels />

        <LandingPainPoints />

        <LandingFeatures />

        <LandingPrivacy />

        <LandingSteps />

        <LandingPricing packages={packages} onSelectPlan={() => handleStartCreation()} />

        <LandingFaq />

        <LandingCta onStartCreation={handleStartCreation} />
      </main>

      <LandingFooter />

      {/* Auth Modals Controlled Declaratively */}
      <LoginModal
        opened={login.loginOpened}
        onClose={login.closeLogin}
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
      />
    </div>
  );
}
