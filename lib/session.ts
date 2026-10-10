import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export type CurrentUser = { id: string; email: string };

// One session lookup per request, however many components and actions ask (React cache()).
// Every protected page and every Server Action calls this itself; layouts are not trusted (D25).
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  return { id: session.user.id, email: session.user.email };
});

// Pages only. Server Actions call getCurrentUser() and handle null themselves (§9, D41).
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
}
