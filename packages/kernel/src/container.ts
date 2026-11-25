/**
 * Dependency Injection container Aether.
 *
 * Mendeteksi duplikat, dependency hilang, siklus, pelanggaran lifetime,
 * dan membersihkan scope secara aman.
 *
 * By Anomalyid.
 */

import type {
  DependencyContainer,
  DependencyScope,
  ResolutionContext,
  ScopeContext,
  ServiceLifetime,
  ServiceProvider,
  ServiceToken,
} from "@aether/contracts";
import { AetherError, ErrorCode } from "@aether/errors";

const LIFETIME_RANK: Record<ServiceLifetime, number> = {
  singleton: 3,
  scoped: 2,
  transient: 1,
};

export interface ResolutionState {
  chain: string[];
  lifetimes: ServiceLifetime[];
}

export interface ServiceEntry<T> {
  provider: ServiceProvider<T>;
  instance?: T;
  created: boolean;
}

export function tokenKey<T>(token: ServiceToken<T>): string {
  return `${token.id}@${token.version}`;
}

async function disposeInstance(value: unknown): Promise<void> {
  if (value === null || typeof value !== "object") return;
  const candidate = value as { dispose?: unknown };
  if (typeof candidate.dispose === "function") {
    await (candidate.dispose as () => Promise<void> | void)();
  }
}

function newState(): ResolutionState {
  return { chain: [], lifetimes: [] };
}

export class AetherContainer implements DependencyContainer {
  private readonly providers = new Map<string, ServiceEntry<unknown>>();
  private readonly singletonOrder: string[] = [];
  private disposed = false;

  register<T>(provider: ServiceProvider<T>): void {
    if (this.disposed) {
      throw new AetherError(
        ErrorCode.KERNEL_CONTAINER_DISPOSED,
        "Container sudah dibersihkan dan tidak dapat menerima registrasi.",
        { category: "execution", retryable: false },
      );
    }
    const key = tokenKey(provider.token);
    if (this.providers.has(key)) {
      throw new AetherError(
        ErrorCode.KERNEL_SERVICE_DUPLICATE,
        `Service ${key} sudah terdaftar.`,
        { category: "dependency", retryable: false, details: { service: key } },
      );
    }
    this.providers.set(key, {
      provider: provider as unknown as ServiceProvider<unknown>,
      created: false,
    });
  }

  has(token: ServiceToken<unknown>): boolean {
    return this.providers.has(tokenKey(token));
  }

  async resolve<T>(token: ServiceToken<T>): Promise<T> {
    if (this.disposed) {
      throw new AetherError(
        ErrorCode.KERNEL_CONTAINER_DISPOSED,
        "Container sudah dibersihkan.",
        { category: "execution", retryable: false },
      );
    }
    return this.resolveInternal(token, newState(), undefined);
  }

  createScope(context: ScopeContext): DependencyScope {
    if (this.disposed) {
      throw new AetherError(
        ErrorCode.KERNEL_CONTAINER_DISPOSED,
        "Container sudah dibersihkan.",
        { category: "execution", retryable: false },
      );
    }
    return new AetherDependencyScope(this, context);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    const failures: string[] = [];
    for (const key of [...this.singletonOrder].reverse()) {
      const entry = this.providers.get(key);
      if (entry === undefined || !entry.created) continue;
      try {
        await disposeInstance(entry.instance);
      } catch {
        failures.push(key);
      }
      entry.created = false;
      entry.instance = undefined;
    }

    if (failures.length > 0) {
      throw new AetherError(
        ErrorCode.KERNEL_DISPOSAL_FAILED,
        `${failures.length} service singleton gagal dibersihkan.`,
        { category: "infrastructure", retryable: false, details: { services: failures } },
      );
    }
  }

  /** @internal Dipakai oleh scope untuk membuat instance scoped. */
  async createInstance<T>(
    token: ServiceToken<T>,
    state: ResolutionState,
    scope: AetherDependencyScope | undefined,
  ): Promise<T> {
    const key = tokenKey(token);
    const entry = this.providers.get(key);
    if (entry === undefined) {
      throw new AetherError(
        ErrorCode.KERNEL_SERVICE_NOT_FOUND,
        `Service ${key} tidak terdaftar.`,
        { category: "dependency", retryable: false, details: { service: key } },
      );
    }

    state.chain.push(key);
    state.lifetimes.push(entry.provider.lifetime);
    try {
      const context = this.createResolutionContext(state, scope);
      const instance = await entry.provider.factory(context);
      if (entry.provider.lifetime === "singleton") {
        entry.instance = instance;
        entry.created = true;
        this.singletonOrder.push(key);
      }
      return instance as T;
    } finally {
      state.chain.pop();
      state.lifetimes.pop();
    }
  }

  /** @internal Dipakai oleh scope. Bukan bagian dari API publik container. */
  async resolveInternal<T>(
    token: ServiceToken<T>,
    state: ResolutionState,
    scope: AetherDependencyScope | undefined,
  ): Promise<T> {
    const key = tokenKey(token);

    if (state.chain.includes(key)) {
      throw new AetherError(
        ErrorCode.KERNEL_SERVICE_CYCLE,
        `Siklus dependency terdeteksi pada service ${key}.`,
        {
          category: "dependency",
          retryable: false,
          details: { chain: [...state.chain, key] },
        },
      );
    }

    const entry = this.providers.get(key);
    if (entry === undefined) {
      throw new AetherError(
        ErrorCode.KERNEL_SERVICE_NOT_FOUND,
        `Service ${key} tidak terdaftar.`,
        { category: "dependency", retryable: false, details: { service: key } },
      );
    }

    const lifetime = entry.provider.lifetime;
    const parent = state.lifetimes.length > 0 ? state.lifetimes[state.lifetimes.length - 1] : undefined;
    if (parent !== undefined && LIFETIME_RANK[parent] > LIFETIME_RANK[lifetime]) {
      throw new AetherError(
        ErrorCode.KERNEL_LIFETIME_VIOLATION,
        `Service ${key} (${lifetime}) tidak boleh di-resolve dari service ${parent}.`,
        {
          category: "dependency",
          retryable: false,
          details: { service: key, requestedLifetime: lifetime, parentLifetime: parent },
        },
      );
    }

    if (lifetime === "singleton") {
      if (entry.created) return entry.instance as T;
      return this.createInstance(token, state, undefined);
    }

    if (lifetime === "scoped") {
      if (scope === undefined) {
        throw new AetherError(
          ErrorCode.KERNEL_SCOPE_REQUIRED,
          `Service scoped ${key} harus di-resolve melalui createScope().`,
          { category: "dependency", retryable: false, details: { service: key } },
        );
      }
      return scope.resolveScoped(token, state);
    }

    return this.createInstance(token, state, scope);
  }

  private createResolutionContext(
    state: ResolutionState,
    scope: AetherDependencyScope | undefined,
  ): ResolutionContext {
    return {
      resolve: <D>(dependency: ServiceToken<D>) =>
        this.resolveInternal(dependency, state, scope),
      scopeContext: scope?.scopeContext ?? { id: "root", values: {} },
    };
  }
}

export class AetherDependencyScope implements DependencyScope {
  private readonly instances = new Map<string, unknown>();
  private readonly order: string[] = [];
  private disposed = false;

  constructor(
    private readonly root: AetherContainer,
    readonly scopeContext: ScopeContext,
  ) {}

  async resolve<T>(token: ServiceToken<T>): Promise<T> {
    if (this.disposed) {
      throw new AetherError(
        ErrorCode.KERNEL_SCOPE_DISPOSED,
        "Scope sudah dibersihkan.",
        { category: "execution", retryable: false },
      );
    }
    return this.root.resolveInternal(token, newState(), this);
  }

  /** @internal Dipanggil oleh container untuk service scoped. */
  async resolveScoped<T>(token: ServiceToken<T>, state: ResolutionState): Promise<T> {
    const key = tokenKey(token);
    const cached = this.instances.get(key);
    if (cached !== undefined) return cached as T;

    const instance = await this.root.createInstance(token, state, this);
    this.instances.set(key, instance);
    this.order.push(key);
    return instance;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    const failures: string[] = [];
    for (const key of [...this.order].reverse()) {
      try {
        await disposeInstance(this.instances.get(key));
      } catch {
        failures.push(key);
      }
    }
    this.instances.clear();
    this.order.length = 0;

    if (failures.length > 0) {
      throw new AetherError(
        ErrorCode.KERNEL_DISPOSAL_FAILED,
        `${failures.length} service scoped gagal dibersihkan.`,
        { category: "infrastructure", retryable: false, details: { services: failures } },
      );
    }
  }
}
