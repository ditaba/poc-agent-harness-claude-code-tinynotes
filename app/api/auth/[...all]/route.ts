// Throwaway R2/R10 spike (SPEC §14 M0): delete before merge.
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/spike/auth";

export const { GET, POST } = toNextJsHandler(auth);
