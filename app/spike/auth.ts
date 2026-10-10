import { mkdirSync } from "node:fs";
import { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";

// Throwaway R2/R10 spike (M0): better-auth on bun:sqlite. Deleted in M0-close.
mkdirSync("data", { recursive: true });

export const auth = betterAuth({
  database: new Database("data/spike-auth.db"),
  emailAndPassword: { enabled: true, autoSignIn: true },
  rateLimit: {
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
});
