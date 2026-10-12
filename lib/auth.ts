import { betterAuth } from "better-auth";
import { db } from "./db";

// One shared connection with the app (D29). No extra trusted origins: better-auth's
// Origin check against BETTER_AUTH_URL stays as is (§10).
export const auth = betterAuth({
  database: db,
  emailAndPassword: { enabled: true, autoSignIn: true }, // default 8–128 password length (D10)
  rateLimit: {
    // D44; the limiter itself stays production-only (better-auth default). R10
    // verified that no advanced.ipAddress option is needed under next start.
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
});
