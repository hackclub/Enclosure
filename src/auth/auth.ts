import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { db } from "../db.js";
import * as schema from "../schema.js";

let _auth: ReturnType<typeof betterAuth> | null = null;

function createAuth() {
  const identityHost = process.env.HC_IDENTITY_HOST!;
  
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    user: {},
    emailAndPassword: {
      enabled: false,
    },
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: "hackclub-identity",
            clientId: process.env.HC_IDENTITY_CLIENT_ID!,
            clientSecret: process.env.HC_IDENTITY_CLIENT_SECRET!,
            discoveryUrl: `${identityHost}/.well-known/openid-configuration`,
            redirectURI: process.env.HC_IDENTITY_REDIRECT_URI!,
            scopes: ['profile', 'email', 'name', 'slack_id', 'verification_status'],
          },
        ],
      }),
    ],
  });
}

export function getAuth() {
  if (!_auth) {
    _auth = createAuth();
  }
  return _auth;
}

export const auth = getAuth();