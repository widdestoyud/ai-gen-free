import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    sid: string;
    user: {
      id: string;
      email: string;
      role: "user" | "admin";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    email: string;
    role: "user" | "admin";
    sid: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sid?: string;
    role?: "user" | "admin";
    email?: string;
  }
}
