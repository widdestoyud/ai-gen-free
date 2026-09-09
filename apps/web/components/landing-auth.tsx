"use client";

import { Button, Group } from "@mantine/core";
import { useLogin } from "@/hooks/use-login";
import { useRegister } from "@/hooks/use-register";
import { LoginModal } from "./login-modal";
import { OtpModal } from "./otp-modal";
import { RegisterModal } from "./register-modal";

export function LandingAuth() {
  const login = useLogin();
  const register = useRegister();

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
    </>
  );
}
