/**
 * Aether Kernel — fondasi runtime paling dasar.
 *
 * By Anomalyid.
 */

export { AetherApplication, defineModule } from "./bootstrap.js";
export type {
  ApplicationState,
  AetherApplicationOptions,
  ModuleDefinition,
} from "./bootstrap.js";

export { AetherContainer, AetherDependencyScope, tokenKey } from "./container.js";
export type { ResolutionState, ServiceEntry } from "./container.js";

export {
  AetherResourceRegistry,
} from "./resource-registry.js";

export {
  HealthManager,
} from "./health.js";
export type { HealthCheck, HealthComponent, HealthReport } from "./health.js";

export {
  LifecycleMachine,
  MODULE_TRANSITIONS,
  isTerminalState,
} from "./lifecycle.js";
export type { ModuleState } from "@aether/contracts";

export { ModuleRegistry, validateManifest } from "./module-registry.js";
export type { ModuleRegistryOptions } from "./module-registry.js";

export { topologicalSort } from "./dependency-graph.js";
export type { GraphNode } from "./dependency-graph.js";

export {
  CONTRACTS_VERSION,
  KERNEL_VERSION,
  compareVersions,
  parseVersion,
  satisfiesSemver,
} from "./version.js";
export type { SemVer } from "./version.js";

export type {
  AetherExecutionContext,
  AetherLogger,
  AetherModule,
  AetherTracer,
  ContractDescriptor,
  DependencyContainer,
  DependencyScope,
  Disposable,
  HealthResult,
  HealthStatus,
  LogMetadata,
  ModuleContext,
  ModuleManifest,
  RegistrationContext,
  ResourceRegistry,
  ScopeContext,
  ServiceLifetime,
  ServiceProvider,
  ServiceToken,
  SpanHandle,
} from "@aether/contracts";
