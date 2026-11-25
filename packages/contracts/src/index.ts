/**
 * Kontrak internal kanonis Aether.
 *
 * Package ini adalah lapisan paling dasar: tidak mengimpor implementasi apa pun.
 * Seluruh domain dan adapter bergantung pada tipe di sini, bukan sebaliknya.
 *
 * By Anomalyid.
 */

export type IsoDateString = string;

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthResult {
  status: HealthStatus;
  checkedAt: IsoDateString;
  message?: string;
  details?: Record<string, unknown>;
}

/** Manifest modul — kontrak internal Aether, bukan standar universal. */
export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  runtime: {
    package: string;
    entrypoint: string;
  };
  compatibility: {
    kernel: string;
    contracts: string;
  };
  dependencies: {
    required: readonly string[];
    optional: readonly string[];
  };
  provides: {
    contracts: readonly string[];
  };
  requires: {
    contracts: readonly string[];
  };
  permissions: {
    requested: readonly string[];
  };
  lifecycle: {
    startupPriority: number;
    shutdownTimeoutMs: number;
  };
  health: {
    enabled: boolean;
  };
}

export type ModuleState =
  | "DISCOVERED"
  | "VALIDATING"
  | "RESOLVING"
  | "REGISTERING"
  | "INITIALIZING"
  | "STARTING"
  | "READY"
  | "STOPPING"
  | "STOPPED"
  | "VALIDATION_FAILED"
  | "DEPENDENCY_FAILED"
  | "INITIALIZATION_FAILED"
  | "START_FAILED"
  | "UNHEALTHY";

export interface TransitionRecord {
  readonly from: ModuleState;
  readonly to: ModuleState;
  readonly at: IsoDateString;
  readonly reason?: string;
}

export interface ContractDescriptor {
  id: string;
  version: string;
  ownerModule: string;
  stability: "experimental" | "stable" | "deprecated";
  compatibility: {
    minimumKernelVersion: string;
  };
  description: string;
}

export interface ServiceToken<T> {
  readonly id: string;
  readonly version: number;
  readonly __type?: T;
}

export type ServiceLifetime = "singleton" | "scoped" | "transient";

export interface ScopeContext {
  readonly id: string;
  readonly tenantId?: string;
  readonly principalId?: string;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface ResolutionContext {
  resolve<T>(token: ServiceToken<T>): Promise<T>;
  readonly scopeContext: ScopeContext;
}

export interface ServiceProvider<T> {
  token: ServiceToken<T>;
  lifetime: ServiceLifetime;
  factory: (context: ResolutionContext) => T | Promise<T>;
}

export interface DependencyScope {
  resolve<T>(token: ServiceToken<T>): Promise<T>;
  dispose(): Promise<void>;
}

export interface DependencyContainer {
  register<T>(provider: ServiceProvider<T>): void;
  resolve<T>(token: ServiceToken<T>): Promise<T>;
  createScope(context: ScopeContext): DependencyScope;
  dispose(): Promise<void>;
}

export interface Disposable {
  dispose(): Promise<void>;
}

export interface ResourceRecord {
  readonly owner?: string;
  readonly resource: Disposable;
}

export interface ResourceRegistry {
  register(resource: Disposable, owner?: string): void;
  disposeAll(): Promise<void>;
  list(): readonly ResourceRecord[];
}

export interface LogMetadata {
  [key: string]: unknown;
}

export interface AetherLogger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  child(bindings: LogMetadata): AetherLogger;
}

export interface SpanHandle {
  end(): void;
  setAttribute(key: string, value: string | number | boolean): void;
}

export interface AetherTracer {
  startSpan(name: string, attributes?: LogMetadata): SpanHandle;
}

export type ActorType = "user" | "agent" | "system" | "service";

/**
 * Context hanya membawa metadata minimum.
 * Dilarang menyimpan secret, data user lengkap, atau hasil retrieval di sini.
 */
export interface AetherExecutionContext {
  requestId: string;
  correlationId: string;
  traceId?: string;
  tenantId?: string;
  principalId?: string;
  actorType: ActorType;
  executionId?: string;
  agentRunId?: string;
  deadline?: string;
  cancellationSignal?: AbortSignal;
}

export interface RegistrationContext {
  registerContract(descriptor: ContractDescriptor): void;
  registerService<T>(provider: ServiceProvider<T>): void;
  registerResource(resource: Disposable, owner?: string): void;
  requestPermissions(permissions: readonly string[]): void;
}

export interface ModuleContext {
  readonly container: DependencyContainer;
  readonly resources: ResourceRegistry;
  readonly config: Readonly<Record<string, unknown>>;
  readonly logger: AetherLogger;
  readonly tracer: AetherTracer;
  readonly execution: AetherExecutionContext;
}

/**
 * Lifecycle modul.
 * register/initialize/start/stop/dispose wajib ada.
 * healthCheck opsional dan dilarang mengubah state bisnis.
 */
export interface AetherModule {
  readonly manifest: ModuleManifest;
  register(context: RegistrationContext): void | Promise<void>;
  initialize(context: ModuleContext): void | Promise<void>;
  start(context: ModuleContext): void | Promise<void>;
  healthCheck?(context: ModuleContext): Promise<HealthResult>;
  stop(context: ModuleContext): void | Promise<void>;
  dispose(context: ModuleContext): void | Promise<void>;
}

export interface AetherErrorShape {
  code: string;
  message: string;
  category:
    | "validation"
    | "dependency"
    | "authorization"
    | "execution"
    | "infrastructure"
    | "internal";
  retryable: boolean;
  retryAfterMs?: number;
  requestId?: string;
  details?: Record<string, unknown>;
}
