import { createAuth } from "./lib/create-auth";

export const {
  handlers: adminHandlers,
  auth: adminAuth,
  signIn: adminSignIn,
  signOut: adminSignOut,
} = createAuth("admin");
