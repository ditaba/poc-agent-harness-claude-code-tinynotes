import { betterAuth } from "better-auth";
import { db } from "./db";
import { LibsqlDialect } from "./libsql-dialect";

// One shared client with the app, through a small Kysely dialect (D29, D49); sign-up's
// writes run in one transaction. No extra trusted origins: better-auth's Origin check
// against BETTER_AUTH_URL stays as is (§10).
export const auth = betterAuth({
  database: {
    dialect: new LibsqlDialect(db),
    type: "sqlite",
    transaction: true,
  },
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
