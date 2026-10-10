import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// The app's only route handler (D13).
export const { GET, POST } = toNextJsHandler(auth);
