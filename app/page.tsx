import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

// NAV-1, D22: `/` only redirects.
export default async function Home() {
  redirect((await getCurrentUser()) ? "/notes" : "/sign-in");
}
