import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create account – TinyNotes" };

export default async function SignUpPage() {
  // Signed-in users go straight to their notes (AUTH-11).
  if (await getCurrentUser()) {
    redirect("/notes");
  }
  return (
    <main className="page-container flex min-h-screen flex-col justify-center py-12">
      <AuthForm mode="sign-up" />
    </main>
  );
}
