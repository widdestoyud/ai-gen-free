import nodemailer from "nodemailer";
import type { EmailPort } from "@ai-gen-free/core";

function smtpSecure(): boolean {
  const raw = (process.env.SMTP_SECURE ?? "").toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return Number(process.env.SMTP_PORT ?? 1025) === 465;
}

function renderEmailLayout({
  title,
  preheader,
  contentHtml,
}: {
  title: string;
  preheader: string;
  contentHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #0d0f14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f1f5f9;">
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">
    ${preheader}
  </div>
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background-color: #151821; border: 1px solid #23293a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <tr>
      <td style="padding: 36px 32px 28px 32px;">
        <!-- Brand Logo / Header -->
        <table border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
          <tr>
            <td style="vertical-align: middle;">
              <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #0284c7 0%, #38bdf8 100%); border-radius: 10px; text-align: center; line-height: 36px; font-weight: 900; font-size: 20px; color: #ffffff;">S</div>
            </td>
            <td style="vertical-align: middle; padding-left: 12px;">
              <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Satu<span style="color: #38bdf8;">Labs</span></span>
            </td>
          </tr>
        </table>

        <!-- Main Content -->
        ${contentHtml}

        <!-- Sign-off -->
        <div style="margin-top: 32px; border-top: 1px solid #23293a; padding-top: 24px;">
          <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
            Terima kasih,<br>
            <strong style="color: #f1f5f9; font-weight: 600;">Tim SatuLabs</strong>
          </p>
        </div>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding: 16px 32px 24px 32px; background-color: #0f121a; text-align: center; border-top: 1px solid #1c2230;">
        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
          Email ini dikirim secara otomatis oleh sistem <a href="https://satulabs.id" style="color: #38bdf8; text-decoration: none;">satulabs.id</a>. Mohon untuk tidak membalas email ini secara langsung.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
  const from = process.env.SMTP_FROM ?? '"SatuLabs" <noreply@satulabs.id>';

  return {
    async sendOtp(email, code) {
      const title = "Login Verification Code - SatuLabs";
      const preheader = `Kode verifikasi masuk Anda: ${code}`;
      const contentHtml = `
        <h1 style="color: #38bdf8; font-size: 24px; font-weight: 700; margin: 0 0 20px 0; letter-spacing: -0.01em;">Login Verification Code</h1>
        <p style="margin: 0 0 12px 0; font-size: 15px; color: #e2e8f0; line-height: 1.6;">Halo,</p>
        <p style="margin: 0 0 20px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
          Untuk melanjutkan proses masuk ke akun <strong>SatuLabs</strong> Anda, silakan gunakan One-Time Password (OTP) berikut:
        </p>
        <div style="margin: 28px 0; text-align: left;">
          <span style="font-family: 'SF Pro Mono', Consolas, Monaco, monospace; font-size: 44px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; display: inline-block;">
            ${code}
          </span>
        </div>
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
          Kode ini akan kedaluwarsa dalam <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapa pun.
        </p>
        <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
          Jika Anda tidak melakukan permintaan masuk ini, abaikan email ini atau segera hubungi tim bantuan SatuLabs untuk mengamankan akun Anda.
        </p>
      `;

      await transporter.sendMail({
        from,
        to: email,
        subject: title,
        text: `Login Verification Code - SatuLabs\n\nKode OTP kamu: ${code}\nBerlaku 10 menit. Jangan bagikan kode ini kepada siapa pun.\n\nJika ini bukan Anda, abaikan email ini.`,
        html: renderEmailLayout({ title, preheader, contentHtml }),
      });
    },

    async sendVerificationEmail(email, token, verifyUrl) {
      const base = process.env.APP_PUBLIC_URL ?? process.env.APP_URL ?? "https://satulabs.id";
      const link = verifyUrl ?? `${base}/auth/email?token=${token}`;
      const title = "Verifikasi Akun - SatuLabs";
      const preheader = "Verifikasi alamat email Anda untuk mengaktifkan akun SatuLabs.";
      const contentHtml = `
        <h1 style="color: #38bdf8; font-size: 24px; font-weight: 700; margin: 0 0 20px 0; letter-spacing: -0.01em;">Verifikasi Akun Anda</h1>
        <p style="margin: 0 0 12px 0; font-size: 15px; color: #e2e8f0; line-height: 1.6;">Halo,</p>
        <p style="margin: 0 0 24px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
          Terima kasih telah mendaftar di <strong>SatuLabs</strong>. Silakan klik tombol di bawah ini untuk memverifikasi alamat email Anda dan mengaktifkan akun:
        </p>
        <div style="margin: 28px 0; text-align: left;">
          <a href="${link}" style="background-color: #0284c7; color: #ffffff; padding: 14px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);">
            Verifikasi Akun Saya
          </a>
        </div>
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
          Atau salin kode verifikasi Anda: <strong style="color: #38bdf8; font-family: monospace; font-size: 15px;">${token}</strong>
        </p>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
          Jika tombol di atas tidak dapat diklik, salin dan buka tautan berikut di peramban Anda:<br>
          <a href="${link}" style="color: #38bdf8; word-break: break-all; font-size: 12px;">${link}</a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
          Tautan verifikasi ini berlaku selama <strong>24 jam</strong>.
        </p>
      `;

      await transporter.sendMail({
        from,
        to: email,
        subject: title,
        text: `Terima kasih telah mendaftar di SatuLabs.\n\nSilakan verifikasi email Anda dengan mengeklik tautan berikut:\n${link}\n\nAtau gunakan kode verifikasi: ${token}\n\nTautan ini berlaku 24 jam.`,
        html: renderEmailLayout({ title, preheader, contentHtml }),
      });
    },

    async sendPasswordResetEmail(email, token, resetUrl) {
      const base = process.env.APP_PUBLIC_URL ?? process.env.APP_URL ?? "https://satulabs.id";
      const link = resetUrl ?? `${base}/auth/password?token=${token}`;
      const title = "Reset Kata Sandi - SatuLabs";
      const preheader = "Permintaan pengaturan ulang kata sandi akun SatuLabs Anda.";
      const contentHtml = `
        <h1 style="color: #38bdf8; font-size: 24px; font-weight: 700; margin: 0 0 20px 0; letter-spacing: -0.01em;">Reset Kata Sandi</h1>
        <p style="margin: 0 0 12px 0; font-size: 15px; color: #e2e8f0; line-height: 1.6;">Halo,</p>
        <p style="margin: 0 0 24px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
          Kami menerima permintaan untuk mengatur ulang kata sandi akun <strong>SatuLabs</strong> Anda. Silakan klik tombol di bawah ini untuk membuat kata sandi baru:
        </p>
        <div style="margin: 28px 0; text-align: left;">
          <a href="${link}" style="background-color: #0284c7; color: #ffffff; padding: 14px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);">
            Atur Ulang Kata Sandi
          </a>
        </div>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
          Tautan ini berlaku dalam waktu terbatas. Jika Anda tidak meminta perubahan kata sandi, abaikan email ini dan akun Anda akan tetap aman.
        </p>
        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
          Alternatif tautan:<br>
          <a href="${link}" style="color: #38bdf8; word-break: break-all; font-size: 12px;">${link}</a>
        </p>
      `;

      await transporter.sendMail({
        from,
        to: email,
        subject: title,
        text: `Reset kata sandi SatuLabs\n\nKlik tautan berikut untuk membuat kata sandi baru:\n${link}\n\nTautan ini berlaku terbatas. Jika Anda tidak meminta reset, abaikan email ini.`,
        html: renderEmailLayout({ title, preheader, contentHtml }),
      });
    },
  };
}
