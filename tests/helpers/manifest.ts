import type { AetherModule, ModuleManifest } from "@aether/contracts";

export function makeManifest(id: string, overrides: Partial<ModuleManifest> = {}): ModuleManifest {
  return {
    id,
    name: id,
    version: "1.0.0",
    description: `Modul uji ${id}`,
    runtime: { package: `@aether/${id}`, entrypoint: "./dist/index.js" },
    compatibility: { kernel: "^0.1.0", contracts: "^0.1.0" },
    dependencies: { required: [], optional: [] },
    provides: { contracts: [] },
    requires: { contracts: [] },
    permissions: { requested: [] },
    lifecycle: { startupPriority: 100, shutdownTimeoutMs: 1000 },
    health: { enabled: false },
    ...overrides,
  };
}

export function makeModule(
  id: string,
  overrides: Partial<ModuleManifest> = {},
  hooks: Partial<Omit<AetherModule, "manifest">> = {},
): AetherModule {
  const noop = async (): Promise<void> => {};
  return {
    manifest: makeManifest(id, overrides),
    register: hooks.register ?? noop,
    initialize: hooks.initialize ?? noop,
    start: hooks.start ?? noop,
    stop: hooks.stop ?? noop,
    dispose: hooks.dispose ?? noop,
    ...(hooks.healthCheck === undefined ? {} : { healthCheck: hooks.healthCheck }),
  };
}
