import { betterAuth } from "better-auth";
import { db } from "./db";

// better-auth shares the app's bun:sqlite connection (D29); it detects a bun:sqlite Database by itself (§12 R2).
// BETTER_AUTH_SECRET and BETTER_AUTH_URL come from the env (checked by db:migrate, D36). Don't add extra
// trusted origins: better-auth's Origin check against BETTER_AUTH_URL must stay as is (§10).
export const auth = betterAuth({
  database: db,
  // name = email is set by the sign-up form (D9); password length is the 8–128 default (D10).
  emailAndPassword: { enabled: true, autoSignIn: true },
  rateLimit: {
    // D44; the limiter itself stays production-only (better-auth default). No advanced.ipAddress is
    // needed: Next sets x-forwarded-for from the socket address, which better-auth reads (§12 R10).
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
});
