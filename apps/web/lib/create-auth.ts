import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

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
      signIn: isAdmin ? "/admin/login" : "/login",
      error: isAdmin ? "/admin/login" : "/login",
    },
    providers: [
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
          const res = await fetch(`${apiBase()}${path}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
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
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          const u = user as { id: string; email?: string | null; role: "user" | "admin"; sid: string };
          token.sid = u.sid;
          token.role = u.role;
          token.email = u.email ?? "";
          token.sub = u.id;
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
