import { betterAuth } from "better-auth";
import { db } from "./db";
import { LibsqlDialect } from "./libsql-dialect";

// better-auth shares the app's libsql client through a small Kysely dialect (D29, D49), and runs sign-up's
// writes in one transaction. BETTER_AUTH_SECRET and BETTER_AUTH_URL come from the env (checked by db:migrate,
// D36). Don't add extra trusted origins: better-auth's Origin check against BETTER_AUTH_URL must stay as is (§10).
export const auth = betterAuth({
  database: {
    dialect: new LibsqlDialect(db),
    type: "sqlite",
    transaction: true,
  },
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
