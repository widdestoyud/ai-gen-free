"use client";

import { Button, Group } from "@mantine/core";
import { useLogin } from "@/hooks/use-login";
import { useRegister } from "@/hooks/use-register";
import { useForgotPassword } from "@/hooks/use-forgot-password";
import { OtpModal } from "@/components/otp-modal";
import { LoginModal } from "./login-modal";
import { RegisterModal } from "./register-modal";
import { ForgotPasswordModal } from "./forgot-password-modal";

export function LandingAuth() {
  const login = useLogin();
  const register = useRegister();
  const forgotPassword = useForgotPassword();

  return (
    <>
      <Group gap="sm">
        <Button type="button" onClick={login.openLogin}>
          Masuk
        </Button>
        <Button type="button" variant="default" onClick={register.openRegister}>
          Daftar
        </Button>
      </Group>

      <LoginModal
        opened={login.loginOpened}
        onClose={login.closeLogin}
        onForgotPassword={() => {
          login.closeLogin();
          forgotPassword.openForgotPassword(login.email);
        }}
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

      <ForgotPasswordModal
        opened={forgotPassword.opened}
        onClose={forgotPassword.closeForgotPassword}
        onBackToLogin={() => {
          forgotPassword.closeForgotPassword();
          login.openLogin();
          if (forgotPassword.email) {
            login.setEmail(forgotPassword.email);
          }
        }}
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
    </>
  );
}
