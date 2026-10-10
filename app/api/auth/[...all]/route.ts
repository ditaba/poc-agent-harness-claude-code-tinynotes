import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/app/spike/auth";

// Throwaway R2/R10 spike (M0): mounts the spike auth. Replaced in M3-auth-server.
export const { GET, POST } = toNextJsHandler(auth);
