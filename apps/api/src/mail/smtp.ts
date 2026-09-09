import nodemailer from "nodemailer";
import type { EmailPort } from "@ai-gen-free/core";

function smtpSecure(): boolean {
  const raw = (process.env.SMTP_SECURE ?? "").toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return Number(process.env.SMTP_PORT ?? 1025) === 465;
}

export function createSmtpMailer(): EmailPort {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "127.0.0.1",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: smtpSecure(),
    auth: user && pass ? { user, pass } : undefined,
  });
  const from = process.env.SMTP_FROM ?? "noreply@localhost";

  return {
    async sendOtp(email, code) {
      await transporter.sendMail({
        from,
        to: email,
        subject: "Kode masuk ai-gen-free",
        text: `Kode OTP kamu: ${code}\nBerlaku 10 menit. Jangan bagikan kode ini.`,
      });
    },
    async sendVerificationEmail(email, token, verifyUrl) {
      const base = process.env.APP_PUBLIC_URL ?? process.env.APP_URL ?? "http://localhost:3000";
      const link = verifyUrl ?? `${base}/auth/email?token=${token}`;
      await transporter.sendMail({
        from,
        to: email,
        subject: "Verifikasi Akun ai-gen-free",
        text: `Terima kasih telah mendaftar di ai-gen-free.\n\nSilakan verifikasi email Anda dengan mengeklik tautan berikut:\n${link}\n\nAtau gunakan kode/token verifikasi: ${token}\n\nTautan ini berlaku 24 jam. Jangan bagikan kepada siapa pun.`,
      });
    },
    async sendPasswordResetEmail(email, token, resetUrl) {
      const base = process.env.APP_PUBLIC_URL ?? process.env.APP_URL ?? "http://localhost:3000";
      const link = resetUrl ?? `${base}/auth/password?token=${token}`;
      await transporter.sendMail({
        from,
        to: email,
        subject: "Reset kata sandi ai-gen-free",
        text: `Anda meminta reset kata sandi.\n\nKlik tautan berikut untuk membuat kata sandi baru:\n${link}\n\nTautan ini berlaku terbatas. Jika Anda tidak meminta reset, abaikan email ini.`,
      });
    },
  };
}

