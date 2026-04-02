"use client";

import { signOut } from "next-auth/react";

/**
 * Clears the session then navigates on the **current browser origin**.
 * Avoids redirects to `NEXTAUTH_URL` when that env still points at localhost in Docker/production.
 */
export async function signOutAtCurrentOrigin(path = "/auth/login"): Promise<void> {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const target = `${window.location.origin}${suffix}`;
  await signOut({ redirect: false });
  window.location.assign(target);
}
