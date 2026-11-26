/**
 * Adapter database Aether.
 *
 * By Anomalyid.
 */

export { createMemoryIdentityRepositories } from "./memory/identity-repositories.js";
export { createMemorySecurityRepositories } from "./memory/security-repositories.js";
export type { SecurityRepositories } from "./memory/security-repositories.js";
export { createMemoryCapabilityRepositories } from "./memory/capability-repositories.js";
export type { CapabilityRepositories } from "./memory/capability-repositories.js";
export { createMemoryAgentRepositories } from "./memory/agent-repositories.js";
export type { AgentRepositories } from "./memory/agent-repositories.js";
export { MemoryProcessedEventStore, MemoryOutboxStore } from "./memory/event-repositories.js";
export { runMigrations, MIGRATION_ORDER } from "./postgres/migration-runner.js";
export { setTenantContext, clearTenantContext, withTenant } from "./postgres/tenant-context.js";
export { PgTenantRunner, createPgIdentityRepositories } from "./postgres/identity-repositories.js";
export { createPgSecurityRepositories } from "./postgres/security-repositories.js";
export { createMemoryWorkflowRepositories } from "./memory/workflow-repositories.js";
export type { WorkflowRepositories } from "./memory/workflow-repositories.js";

export const MIGRATION_FILES = {
  identity: "migrations/0001_identity.sql",
  security: "migrations/0002_security.sql",
  capability: "migrations/0003_capability.sql",
  agents: "migrations/0004_agents.sql",
  events: "migrations/0005_events.sql",
  principalGlobalUnique: "migrations/0006_principal_global_unique.sql",
} as const;
