/**
 * Bootstrap dan graceful shutdown aplikasi Aether.
 *
 * Urutan startup deterministik, rollback saat kegagalan, dan cleanup
 * resource dalam urutan terbalik dependency.
 *
 * By Anomalyid.
 */

import type {
  AetherExecutionContext,
  AetherLogger,
  AetherModule,
  AetherTracer,
  ContractDescriptor,
  DependencyContainer,
  LogMetadata,
  ModuleContext,
  RegistrationContext,
  ResourceRegistry,
  ServiceProvider,
  SpanHandle,
} from "@aether/contracts";
import { createSystemContext, runWithContext } from "@aether/context";
import { AetherError, ErrorCode, normalizeError, redactSecrets } from "@aether/errors";
import { AetherContainer } from "./container.js";
import { HealthManager, type HealthReport } from "./health.js";
import type { ModuleState } from "@aether/contracts";
import { LifecycleMachine } from "./lifecycle.js";
import { AetherResourceRegistry } from "./resource-registry.js";
import { ModuleRegistry, type ModuleRegistryOptions } from "./module-registry.js";

export type ApplicationState = "CREATED" | "STARTING" | "READY" | "STOPPING" | "STOPPED" | "FAILED";

export interface AetherApplicationOptions extends ModuleRegistryOptions {
  modules: readonly AetherModule[];
  config?: Readonly<Record<string, unknown>>;
  logger?: AetherLogger;
  tracer?: AetherTracer;
  shutdownTimeoutMs?: number;
}

export type ModuleDefinition = { manifest: AetherModule["manifest"] } & Partial<Omit<AetherModule, "manifest">>;

/** Helper untuk membuat modul dengan hook default yang aman. */
export function defineModule(definition: ModuleDefinition): AetherModule {
  const noop = async (): Promise<void> => {};
  return {
    manifest: definition.manifest,
    register: definition.register ?? noop,
    initialize: definition.initialize ?? noop,
    start: definition.start ?? noop,
    stop: definition.stop ?? noop,
    dispose: definition.dispose ?? noop,
    ...(definition.healthCheck === undefined ? {} : { healthCheck: definition.healthCheck }),
  };
}

function safeMeta(bindings: LogMetadata, metadata?: LogMetadata): Record<string, unknown> {
  return redactSecrets({ ...bindings, ...(metadata ?? {}) }) as Record<string, unknown>;
}

function createDefaultLogger(): AetherLogger {
  const create = (bindings: LogMetadata): AetherLogger => ({
    debug: (message, metadata) => console.debug("[Aether]", message, safeMeta(bindings, metadata)),
    info: (message, metadata) => console.info("[Aether]", message, safeMeta(bindings, metadata)),
    warn: (message, metadata) => console.warn("[Aether]", message, safeMeta(bindings, metadata)),
    error: (message, metadata) => console.error("[Aether]", message, safeMeta(bindings, metadata)),
    child: (more) => create({ ...bindings, ...more }),
  });
  return create({});
}

const NOOP_SPAN: SpanHandle = {
  end: () => {},
  setAttribute: () => {},
};

const NOOP_TRACER: AetherTracer = {
  startSpan: () => NOOP_SPAN,
};

interface ModuleRuntime {
  module: AetherModule;
  lifecycle: LifecycleMachine;
  registered: boolean;
  initialized: boolean;
  started: boolean;
}

const FAILURE_STATE: Partial<Record<ModuleState, ModuleState>> = {
  VALIDATING: "VALIDATION_FAILED",
  RESOLVING: "DEPENDENCY_FAILED",
  REGISTERING: "DEPENDENCY_FAILED",
  INITIALIZING: "INITIALIZATION_FAILED",
  STARTING: "START_FAILED",
};

async function withTimeout<T>(
  operation: () => Promise<T> | T,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new AetherError(
          ErrorCode.KERNEL_SHUTDOWN_TIMEOUT,
          `${label} melebihi batas waktu ${timeoutMs} ms.`,
          { category: "infrastructure", retryable: false, details: { label, timeoutMs } },
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve().then(operation), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export class AetherApplication {
  private readonly registry: ModuleRegistry;
  private readonly containerInstance: AetherContainer;
  private readonly resourceRegistry: AetherResourceRegistry;
  private readonly healthManager: HealthManager;
  private readonly executionContext: AetherExecutionContext;
  private readonly logger: AetherLogger;
  private readonly tracer: AetherTracer;
  private readonly runtimes: ModuleRuntime[];
  private readonly runtimeById: Map<string, ModuleRuntime>;
  private readonly contracts = new Map<string, ContractDescriptor>();
  private readonly grantedPermissions = new Set<string>();
  private ordered: ModuleRuntime[] = [];
  private effects: ModuleRuntime[] = [];
  private applicationState: ApplicationState = "CREATED";

  private constructor(
    private readonly options: AetherApplicationOptions,
    registry: ModuleRegistry,
    containerInstance: AetherContainer,
    resourceRegistry: AetherResourceRegistry,
    healthManager: HealthManager,
    executionContext: AetherExecutionContext,
    logger: AetherLogger,
    tracer: AetherTracer,
    runtimes: ModuleRuntime[],
  ) {
    this.registry = registry;
    this.containerInstance = containerInstance;
    this.resourceRegistry = resourceRegistry;
    this.healthManager = healthManager;
    this.executionContext = executionContext;
    this.logger = logger;
    this.tracer = tracer;
    this.runtimes = runtimes;
    this.runtimeById = new Map(runtimes.map((runtime) => [runtime.module.manifest.id, runtime]));
  }

  static create(options: AetherApplicationOptions): AetherApplication {
    const registry = new ModuleRegistry(options);
    for (const module of options.modules) registry.register(module);

    const runtimes = options.modules.map((module) => ({
      module,
      lifecycle: new LifecycleMachine(module.manifest.id),
      registered: false,
      initialized: false,
      started: false,
    }));

    return new AetherApplication(
      options,
      registry,
      new AetherContainer(),
      new AetherResourceRegistry(),
      new HealthManager(),
      createSystemContext(),
      options.logger ?? createDefaultLogger(),
      options.tracer ?? NOOP_TRACER,
      runtimes,
    );
  }

  get state(): ApplicationState {
    return this.applicationState;
  }

  get container(): DependencyContainer {
    return this.containerInstance;
  }

  get resources(): ResourceRegistry {
    return this.resourceRegistry;
  }

  get health(): HealthManager {
    return this.healthManager;
  }

  getContracts(): readonly ContractDescriptor[] {
    return [...this.contracts.values()];
  }

  getGrantedPermissions(): readonly string[] {
    return [...this.grantedPermissions];
  }

  async getHealthReport(): Promise<HealthReport> {
    return this.healthManager.report();
  }

  async start(): Promise<void> {
    if (this.applicationState !== "CREATED") {
      throw new AetherError(
        ErrorCode.RESOURCE_CONFLICT,
        `Aplikasi tidak dapat dimulai dari state ${this.applicationState}.`,
        { category: "execution", retryable: false },
      );
    }

    this.applicationState = "STARTING";

    try {
      for (const runtime of this.runtimes) {
        runtime.lifecycle.transition("VALIDATING");
        runtime.lifecycle.transition("RESOLVING");
      }

      this.registry.validateAll();
      this.ordered = this.registry
        .resolveStartupOrder()
        .map((module) => this.requireRuntime(module.manifest.id));

      for (const runtime of this.ordered) {
        runtime.lifecycle.transition("REGISTERING");
        await runWithContext(this.executionContext, () =>
          runtime.module.register(this.registrationContextFor(runtime)),
        );
        runtime.registered = true;
        runtime.lifecycle.transition("INITIALIZING");
      }

      for (const runtime of this.ordered) {
        await runWithContext(this.executionContext, () =>
          runtime.module.initialize(this.moduleContextFor(runtime)),
        );
        runtime.initialized = true;
        this.effects.push(runtime);
        runtime.lifecycle.transition("STARTING");
      }

      for (const runtime of this.ordered) {
        await runWithContext(this.executionContext, () =>
          runtime.module.start(this.moduleContextFor(runtime)),
        );
        runtime.started = true;
        if (runtime.module.manifest.health.enabled && runtime.module.healthCheck !== undefined) {
          const check = runtime.module.healthCheck;
          this.healthManager.register(runtime.module.manifest.id, () =>
            check.call(runtime.module, this.moduleContextFor(runtime)),
          );
        }
        runtime.lifecycle.transition("READY");
      }

      this.healthManager.setReady(true);
      this.applicationState = "READY";
      this.logger.info("Aether siap menerima traffic.", {
        modules: this.ordered.map((runtime) => runtime.module.manifest.id),
      });
    } catch (error) {
      this.markFailureStates();
      await this.rollback();
      this.applicationState = "FAILED";
      throw normalizeError(error, ErrorCode.KERNEL_MODULE_START_FAILED);
    }
  }

  async shutdown(): Promise<void> {
    if (this.applicationState === "STOPPED") return;

    const previousState = this.applicationState;
    this.applicationState = "STOPPING";
    this.healthManager.setReady(false);

    const reverse = [...this.ordered].reverse();
    const timeoutMs = this.options.shutdownTimeoutMs ?? 30_000;

    // Fase 1: hentikan seluruh modul dalam urutan terbalik dependency.
    for (const runtime of reverse) {
      const id = runtime.module.manifest.id;
      const stopTimeout = runtime.module.manifest.lifecycle.shutdownTimeoutMs;
      try {
        if (runtime.started) {
          await withTimeout(
            () => runWithContext(this.executionContext, () => runtime.module.stop(this.moduleContextFor(runtime))),
            Math.min(stopTimeout, timeoutMs),
            `stop ${id}`,
          );
          runtime.started = false;
        }
        runtime.lifecycle.transitionIfAllowed("STOPPING", "shutdown");
        this.healthManager.unregister(id);
      } catch (error) {
        this.logger.warn("Gagal menghentikan modul saat shutdown.", {
          module: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fase 2: bersihkan resource seluruh modul dalam urutan terbalik dependency.
    for (const runtime of reverse) {
      const id = runtime.module.manifest.id;
      const stopTimeout = runtime.module.manifest.lifecycle.shutdownTimeoutMs;
      try {
        if (runtime.initialized) {
          await withTimeout(
            () => runWithContext(this.executionContext, () => runtime.module.dispose(this.moduleContextFor(runtime))),
            Math.min(stopTimeout, timeoutMs),
            `dispose ${id}`,
          );
          runtime.initialized = false;
        }
        runtime.lifecycle.transitionIfAllowed("STOPPED", "shutdown");
      } catch (error) {
        this.logger.warn("Gagal membersihkan modul saat shutdown.", {
          module: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      await this.containerInstance.dispose();
    } catch (error) {
      this.logger.warn("Gagal membersihkan container.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await this.resourceRegistry.disposeAll();
    } catch (error) {
      this.logger.warn("Gagal membersihkan resource.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.effects = [];
    this.applicationState = "STOPPED";
    if (previousState === "FAILED") {
      this.logger.info("Shutdown selesai setelah startup gagal.");
    }
  }

  private requireRuntime(id: string): ModuleRuntime {
    const runtime = this.runtimeById.get(id);
    if (runtime === undefined) {
      throw new AetherError(
        ErrorCode.KERNEL_MODULE_NOT_FOUND,
        `Runtime untuk modul ${id} tidak ditemukan.`,
        { category: "dependency", retryable: false, details: { id } },
      );
    }
    return runtime;
  }

  private registrationContextFor(runtime: ModuleRuntime): RegistrationContext {
    const moduleId = runtime.module.manifest.id;
    return {
      registerContract: (descriptor) => {
        if (this.contracts.has(descriptor.id)) {
          throw new AetherError(
            ErrorCode.RESOURCE_CONFLICT,
            `Contract ${descriptor.id} sudah didaftarkan.`,
            { category: "execution", retryable: false, details: { contract: descriptor.id } },
          );
        }
        this.contracts.set(descriptor.id, descriptor);
      },
      registerService: <T>(provider: ServiceProvider<T>) => {
        this.containerInstance.register(provider);
      },
      registerResource: (resource, owner) => {
        this.resourceRegistry.register(resource, owner ?? moduleId);
      },
      requestPermissions: (permissions) => {
        // Dicatat untuk audit. Pemberian izin sesungguhnya berada di domain Security.
        for (const permission of permissions) this.grantedPermissions.add(permission);
      },
    };
  }

  private moduleContextFor(runtime: ModuleRuntime): ModuleContext {
    const safeConfig = redactSecrets(this.options.config ?? {}) as Record<string, unknown>;
    return {
      container: this.containerInstance,
      resources: this.resourceRegistry,
      config: safeConfig,
      logger: this.logger.child({ module: runtime.module.manifest.id }),
      tracer: this.tracer,
      execution: this.executionContext,
    };
  }

  private markFailureStates(): void {
    for (const runtime of this.runtimes) {
      const failure = FAILURE_STATE[runtime.lifecycle.state];
      if (failure !== undefined) runtime.lifecycle.transitionIfAllowed(failure, "startup failure");
    }
  }

  private async rollback(): Promise<void> {
    const reversed = [...this.effects].reverse();

    for (const runtime of reversed) {
      const id = runtime.module.manifest.id;
      try {
        if (runtime.started) {
          await runtime.module.stop(this.moduleContextFor(runtime));
          runtime.started = false;
        }
        runtime.lifecycle.transitionIfAllowed("STOPPING", "rollback");
      } catch (error) {
        this.logger.warn("Gagal menghentikan modul saat rollback.", {
          module: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const runtime of reversed) {
      const id = runtime.module.manifest.id;
      try {
        if (runtime.initialized) {
          await runtime.module.dispose(this.moduleContextFor(runtime));
          runtime.initialized = false;
        }
        runtime.lifecycle.transitionIfAllowed("STOPPED", "rollback");
      } catch (error) {
        this.logger.warn("Gagal membersihkan modul saat rollback.", {
          module: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      await this.resourceRegistry.disposeAll();
    } catch (error) {
      this.logger.warn("Gagal membersihkan resource saat rollback.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.effects = [];
  }
}
