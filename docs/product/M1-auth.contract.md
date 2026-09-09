# M1 contract

**SA**

## Routes (api, prefix `/api`)

| Method | Path | Auth | Result |
|---|---|---|---|
| POST | `/auth/otp/request` | no | `{ ok: true }` always if format valid (anti-enumeration) |
| POST | `/auth/otp/verify` | no | Set-Cookie `sid`; `{ user: { id, email, role } }` |
| POST | `/auth/logout` | sid | clear cookie |
| GET | `/me` | sid | `{ user }` |
| POST | `/auth/password-reset` | no | `{ ok, message, email }` atau `A018`/`A008`/`A021`/`A022` |
| POST | `/auth/password-reset-validation` | no | body `{ token }`; `{ ok, message }` jika token hidup; tidak consume |
| POST | `/auth/password-reset-confirm` | no | `{ ok, message }`; cabut sesi; set `passwordChangedAt` |
| POST | `/admin/auth/otp/request` | Basic Auth | OTP ke email admin |
| POST | `/admin/auth/otp/verify` | Basic Auth | Cookie `sid_admin` |

Codes: `INVALID_EMAIL`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED`, `UNAUTHENTICATED`, `FORBIDDEN`, `RATE_LIMITED`, `EMAIL_NOT_FOUND` (`A018`), `PASSWORD_RESET_PENDING` (`A021`), `PASSWORD_RESET_COOLDOWN` (`A022`), `PASSWORD_RESET_TOKEN_INVALID` (`A023`), `WEAK_PASSWORD`.

## Cookies

- `sid` / `sid_admin`: httpOnly, Secure (prod), SameSite=Lax, path `/`
- Token raw hanya di cookie; DB simpan hash
- Login sukses: `DELETE FROM Session WHERE userId=? AND kind=?` lalu insert baru

## FE

- `/login`, `/otp`, `/` (redirect jika belum sesi)
- Jangan simpan token di localStorage
- Fetch ke `/api` with credentials
