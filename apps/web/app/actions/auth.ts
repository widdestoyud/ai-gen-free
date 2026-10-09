"use server";

import { signIn } from "@/auth";

export async function signInWithGoogle(redirectTo: string = "/app/generate") {
  await signIn("google", { redirectTo });
}
