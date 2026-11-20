import { createAuthClient } from "better-auth/react";

/** Better Auth client for the web app: same origin, httpOnly session cookie. */
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  basePath: "/api/auth",
});

export const useSession = authClient.useSession;
