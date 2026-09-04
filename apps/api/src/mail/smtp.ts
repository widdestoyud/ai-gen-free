import nodemailer from "nodemailer";
import type { EmailPort } from "@ai-gen-free/core";

export function createSmtpMailer(): EmailPort {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "127.0.0.1",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
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
  };
}
