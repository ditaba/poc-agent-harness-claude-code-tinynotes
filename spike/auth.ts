// Throwaway R2/R10 spike (SPEC §14 M0): delete before merge.
import { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: new Database(process.env.SPIKE_DB_PATH ?? "data/spike.db"),
  emailAndPassword: { enabled: true },
  rateLimit: {
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
});
