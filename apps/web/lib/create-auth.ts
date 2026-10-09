import { headers as getNextHeaders } from "next/headers";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

export type AppKind = "user" | "admin";

function apiBase(): string {
  return process.env.API_INTERNAL_URL ?? "http://api:4000";
}

function adminBasicHeaders(): Record<string, string> {
  const user = process.env.ADMIN_BASIC_USER ?? "";
  const pass = process.env.ADMIN_BASIC_PASSWORD ?? "";
  if (!user || !pass) return {};
  return { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` };
}

async function getForwardHeaders(): Promise<Record<string, string>> {
  try {
    const reqHeaders = await getNextHeaders();
    const result: Record<string, string> = {};
    const forwardList = [
      "user-agent",
      "cf-connecting-ip",
      "cf-ipcity",
      "cf-ipcountry",
      "cf-region",
      "cf-asorganization",
      "x-forwarded-for",
      "x-real-ip",
      "x-device-id",
    ];
    for (const key of forwardList) {
      const val = reqHeaders.get(key);
      if (val) result[key] = val;
    }
    return result;
  } catch {
    return {};
  }
}

function parseSid(kind: AppKind, res: Response, body: { sessionToken?: string }): string | null {
  if (typeof body.sessionToken === "string" && body.sessionToken.length > 0) {
    return body.sessionToken;
  }
  const name = kind === "admin" ? "sid_admin" : "sid";
  const cookies = res.headers.getSetCookie?.() ?? [];
  for (const raw of cookies) {
    const part = raw.split(";")[0] ?? "";
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

export function createAuth(kind: AppKind) {
  const isAdmin = kind === "admin";
  return NextAuth({
    secret: process.env.AUTH_SECRET ?? process.env.SESSION_SECRET,
    trustHost: true,
    basePath: isAdmin ? "/api/admin/session" : "/api/session",
    session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
    cookies: {
      sessionToken: {
        name: isAdmin ? "authjs.admin-session" : "authjs.session-token",
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: process.env.COOKIE_SECURE === "true",
        },
      },
    },
    pages: {
      signIn: isAdmin ? "/admin" : "/",
      error: isAdmin ? "/admin" : "/",
    },
    providers: [
      Credentials({
        id: "password",
        name: "Password",
        credentials: {
          email: { label: "Email", type: "email" },
          username: { label: "Username", type: "text" },
          password: { label: "Password", type: "password" },
        },
        authorize: async (credentials) => {
          const password = typeof credentials?.password === "string" ? credentials.password : "";
          const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
          const username = typeof credentials?.username === "string" ? credentials.username.trim() : "";
          const path = isAdmin ? "/api/admin/login" : "/api/user/login";
          const payload = isAdmin ? { username: username || email, password } : { email, password };
          const forwardHeaders = await getForwardHeaders();
          const res = await fetch(`${apiBase()}${path}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...forwardHeaders,
              ...(isAdmin ? adminBasicHeaders() : {}),
            },
            body: JSON.stringify(payload),
          });
          const body = (await res.json()) as {
            ok?: boolean;
            requiresOtp?: boolean;
            message?: string;
            user?: { id: string; email?: string; username?: string; role: "user" | "admin" };
            sessionToken?: string;
            error?: { code?: string; message: string };
            transaction_id?: string;
          };
          if (body.requiresOtp) {
            const txid = body.transaction_id ?? res.headers.get("x-transaction-id") ?? "";
            class OtpRequiredError extends CredentialsSignin {
              code = `A016||${body.message ?? "Kode OTP diperlukan"}||${txid}||OTP_REQUIRED`;
            }
            throw new OtpRequiredError();
          }
          if (!res.ok || !body.user) {
            const errCode = body.error?.code ?? "A012";
            const errMsg = body.error?.message ?? "Kata sandi yang Anda masukkan salah.";
            const txid = body.transaction_id ?? res.headers.get("x-transaction-id") ?? "";
            class AuthVerifyError extends CredentialsSignin {
              code = `${errCode}||${errMsg}||${txid}`;
            }
            throw new AuthVerifyError();
          }
          const sid = parseSid(kind, res, body);
          if (!sid) return null;
          return {
            id: body.user.id,
            email: body.user.email ?? body.user.username ?? email ?? username,
            role: body.user.role,
            sid,
          };
        },
      }),
      Credentials({
        id: "otp",
        name: "OTP",
        credentials: {
          email: { label: "Email", type: "email" },
          code: { label: "Kode", type: "text" },
        },
        authorize: async (credentials) => {
          const email = typeof credentials?.email === "string" ? credentials.email : "";
          const code = typeof credentials?.code === "string" ? credentials.code : "";
          const path = isAdmin ? "/api/admin/auth/otp/verify" : "/api/auth/otp/verify";
          const forwardHeaders = await getForwardHeaders();
          const res = await fetch(`${apiBase()}${path}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...forwardHeaders,
              ...(isAdmin ? adminBasicHeaders() : {}),
            },
            body: JSON.stringify({ email, code }),
          });
          const body = (await res.json()) as {
            user?: { id: string; email: string; role: "user" | "admin" };
            sessionToken?: string;
            error?: { code?: string; message: string };
            transaction_id?: string;
          };
          if (!res.ok || !body.user) {
            const errCode = body.error?.code ?? "A002";
            const errMsg = body.error?.message ?? "Kode salah";
            const txid = body.transaction_id ?? res.headers.get("x-transaction-id") ?? "";
            class AuthVerifyError extends CredentialsSignin {
              code = `${errCode}||${errMsg}||${txid}`;
            }
            throw new AuthVerifyError();
          }
          const sid = parseSid(kind, res, body);
          if (!sid) return null;
          return {
            id: body.user.id,
            email: body.user.email,
            role: body.user.role,
            sid,
          };
        },
      }),
      ...(!isAdmin && (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID)
        ? [
            Google({
              clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID!,
              clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET!,
            }),
          ]
        : []),
    ],
    callbacks: {
      async signIn({ user, account }) {
        if (account?.provider === "google") {
          const idToken = account.id_token;
          if (!idToken) return false;
          try {
            const forwardHeaders = await getForwardHeaders();
            const res = await fetch(`${apiBase()}/auth/google`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(process.env.INTERNAL_API_SECRET ? { "x-internal-secret": process.env.INTERNAL_API_SECRET } : {}),
                ...forwardHeaders,
              },
              body: JSON.stringify({ idToken }),
            });
            const body = (await res.json()) as {
              ok?: boolean;
              token?: string;
              sid?: string;
              user?: { id: string; email: string; role: "user" | "admin" };
              error?: { code?: string; message: string };
            };
            if (!res.ok || !body.user) {
              const errMsg = body.error?.message ?? "Gagal masuk dengan Google.";
              const errCode = body.error?.code ?? "A007";
              return `/?error=${encodeURIComponent(errMsg)}&code=${encodeURIComponent(errCode)}`;
            }
            const sid = body.token ?? body.sid;
            if (!sid) return false;
            (user as any).id = body.user.id;
            (user as any).email = body.user.email;
            (user as any).role = body.user.role;
            (user as any).sid = sid;
            return true;
          } catch (err) {
            console.error("Google sign-in exchange error:", err);
            return false;
          }
        }
        return true;
      },
      async jwt({ token, user }) {
        if (user) {
          const u = user as { id: string; email?: string | null; role: "user" | "admin"; sid?: string };
          if (u.sid) token.sid = u.sid;
          if (u.role) token.role = u.role;
          if (u.email) token.email = u.email;
          if (u.id) token.sub = u.id;
        }
        return token;
      },
      async session({ session, token }) {
        const sid = typeof token.sid === "string" ? token.sid : "";
        const role = token.role === "admin" ? "admin" : "user";
        const email = typeof token.email === "string" ? token.email : "";
        const id = typeof token.sub === "string" ? token.sub : "";
        session.sid = sid;
        session.user = {
          ...session.user,
          id,
          email,
          role,
        };
        return session;
      },
    },
  });
}
