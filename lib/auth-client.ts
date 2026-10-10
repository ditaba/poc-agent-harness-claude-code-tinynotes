import { createAuthClient } from "better-auth/react";

// Auth forms only (D11). No baseURL: in the browser the client calls /api/auth on the page's own origin.
export const authClient = createAuthClient();
