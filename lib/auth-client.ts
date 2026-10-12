import { createAuthClient } from "better-auth/react";

// Same origin as the app, so no baseURL (D11).
export const authClient = createAuthClient();
