/**
 * Adapter database Aether.
 *
 * By Anomalyid.
 */

export { createMemoryIdentityRepositories } from "./memory/identity-repositories.js";
export { createMemorySecurityRepositories } from "./memory/security-repositories.js";
export type { SecurityRepositories } from "./memory/security-repositories.js";

export const MIGRATION_FILES = {
  identity: "migrations/0001_identity.sql",
  security: "migrations/0002_security.sql",
} as const;
