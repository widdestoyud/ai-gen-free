import { createAuth } from "./lib/create-auth";

export const { handlers, auth, signIn, signOut } = createAuth("user");
