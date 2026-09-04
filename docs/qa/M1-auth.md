# QA — M1 auth

| Case | Result | Evidence |
|---|---|---|
| Disposable email | pass | `400 INVALID_EMAIL` untuk `a@mailinator.com` |
| OTP request + Mailpit | pass | subjek `Kode masuk ai-gen-free`, kode 6 digit |
| Verify + cookie | pass | `200` user `role=user` meski body `role=admin` |
| GET `/api/me` | pass | 200 dengan email yang sama |
| Login perangkat kedua | pass | sesi lama `401` |
| `/api/admin/*` tanpa Basic | pass | `401` |
| `/admin` tanpa Basic | pass | `401 Autentikasi admin diperlukan` |
| Admin OTP + Basic | pass | verify + `/api/admin/me` 200 `role=admin` |
| Halaman `/login` | pass | 200, copy Indonesia |

OTP disimpan sebagai hash, bukan plaintext (lihat `otpChallenge.codeHash`).
