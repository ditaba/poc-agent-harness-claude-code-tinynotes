import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

// `/` only redirects: signed in → /notes, signed out → /sign-in (NAV-1, D22).
export default async function HomePage() {
  redirect((await getCurrentUser()) ? "/notes" : "/sign-in");
}
