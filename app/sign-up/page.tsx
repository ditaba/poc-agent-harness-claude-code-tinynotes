import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create account – TinyNotes" };

export default async function SignUpPage() {
  // AUTH-11: signed-in users go straight to their notes.
  if (await getCurrentUser()) redirect("/notes");
  return <AuthForm mode="sign-up" />;
}
