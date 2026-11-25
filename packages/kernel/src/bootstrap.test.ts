import { describe, expect, it } from "vitest";
import type { ServiceToken } from "@aether/contracts";
import { AetherApplication, defineModule } from "./bootstrap";
import { makeManifest, makeModule } from "../../../tests/helpers/manifest";

describe("bootstrap aplikasi Aether", () => {
  it("menjalankan lifecycle sesuai urutan dependency", async () => {
    const events: string[] = [];
    const hooks = (prefix: string) => ({
      initialize: async () => { events.push(`${prefix}:init`); },
      start: async () => { events.push(`${prefix}:start`); },
      stop: async () => { events.push(`${prefix}:stop`); },
      dispose: async () => { events.push(`${prefix}:dispose`); },
    });

    const database = makeModule(
      "aether.db",
      { lifecycle: { startupPriority: 999, shutdownTimeoutMs: 1000 } },
      hooks("db"),
    );
    const application = makeModule(
      "aether.app",
      {
        dependencies: { required: ["aether.db"], optional: [] },
        lifecycle: { startupPriority: 1, shutdownTimeoutMs: 1000 },
      },
      hooks("app"),
    );

    const app = AetherApplication.create({ modules: [application, database] });
    await app.start();
    expect(app.state).toBe("READY");
    expect(events).toEqual(["db:init", "app:init", "db:start", "app:start"]);

    await app.shutdown();
    expect(events).toEqual([
      "db:init",
      "app:init",
      "db:start",
      "app:start",
      "app:stop",
      "db:stop",
      "app:dispose",
      "db:dispose",
    ]);
  });

  it("rollback saat modul gagal start", async () => {
    const events: string[] = [];
    const first = makeModule("aether.first", {}, {
      start: async () => { events.push("first:start"); },
      stop: async () => { events.push("first:stop"); },
      dispose: async () => { events.push("first:dispose"); },
    });
    const second = makeModule(
      "aether.second",
      { dependencies: { required: ["aether.first"], optional: [] } },
      { start: async () => { throw new Error("kegagalan disengaja"); } },
    );

    const app = AetherApplication.create({ modules: [second, first] });
    await expect(app.start()).rejects.toThrow(/kegagalan disengaja/);
    expect(app.state).toBe("FAILED");
    expect(events).toContain("first:stop");
    expect(events).toContain("first:dispose");
  });

  it("shutdown bersifat idempoten", async () => {
    const dispose = () => Promise.resolve();
    const app = AetherApplication.create({
      modules: [makeModule("aether.idempoten", {}, { dispose })],
    });
    await app.start();
    await app.shutdown();
    await app.shutdown();
    expect(app.state).toBe("STOPPED");
  });

  it("menolak modul dengan versi kernel tidak kompatibel", () => {
    expect(() =>
      AetherApplication.create({
        modules: [
          makeModule("aether.bad", {
            compatibility: { kernel: "^9.0.0", contracts: "^0.1.0" },
          }),
        ],
      }),
    ).toThrow(/kompatibel/);
  });

  it("menolak dependency siklus saat start", async () => {
    const a = makeModule("aether.a", {
      dependencies: { required: ["aether.b"], optional: [] },
    });
    const b = makeModule("aether.b", {
      dependencies: { required: ["aether.a"], optional: [] },
    });
    const app = AetherApplication.create({ modules: [a, b] });
    await expect(app.start()).rejects.toThrow(/siklus/i);
    expect(app.state).toBe("FAILED");
  });

  it("menghasilkan health report dari module health check", async () => {
    const module = makeModule("aether.sehat", { health: { enabled: true } }, {
      healthCheck: async () => ({
        status: "healthy",
        checkedAt: new Date().toISOString(),
        message: "modul sehat",
      }),
    });
    const app = AetherApplication.create({ modules: [module] });
    await app.start();

    const report = await app.getHealthReport();
    expect(report.status).toBe("healthy");
    expect(report.components.some((component) => component.id === "aether.sehat")).toBe(true);
    await app.shutdown();
  });

  it("menyaring secret dari config sebelum diberikan ke modul", async () => {
    let captured: Readonly<Record<string, unknown>> | undefined;
    const module = makeModule("aether.config", {}, {
      initialize: async (context) => { captured = context.config; },
    });
    const app = AetherApplication.create({
      modules: [module],
      config: { apiToken: "sk-abcdefghijklmnopqrstuvwxyz123456", mode: "uji" },
    });
    await app.start();

    expect(JSON.stringify(captured)).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(JSON.stringify(captured)).toContain("[REDACTED]");
    await app.shutdown();
  });

  it("menyelesaikan shutdown meski modul lambat", async () => {
    const module = makeModule("aether.lambat", {
      lifecycle: { startupPriority: 100, shutdownTimeoutMs: 30 },
    }, {
      stop: async () => new Promise<void>((resolve) => setTimeout(resolve, 500)),
      dispose: async () => new Promise<void>((resolve) => setTimeout(resolve, 500)),
    });

    const app = AetherApplication.create({ modules: [module], shutdownTimeoutMs: 40 });
    await app.start();
    await app.shutdown();
    expect(app.state).toBe("STOPPED");
  }, 5000);

  it("mendaftarkan contract, service, dan permission melalui registration context", async () => {
    const token = { id: "demo.service", version: 1 } as ServiceToken<{ value: number }>;
    const module = defineModule({
      manifest: makeManifest("aether.registrasi"),
      register: (context) => {
        context.registerContract({
          id: "demo.service.v1",
          version: "1.0.0",
          ownerModule: "aether.registrasi",
          stability: "experimental",
          compatibility: { minimumKernelVersion: "0.1.0" },
          description: "Layanan uji",
        });
        context.registerService({
          token,
          lifetime: "singleton",
          factory: () => ({ value: 42 }),
        });
        context.requestPermissions(["demo.read"]);
      },
    });

    const app = AetherApplication.create({ modules: [module] });
    await app.start();

    expect(app.getContracts()).toHaveLength(1);
    expect(app.getGrantedPermissions()).toContain("demo.read");
    expect(await app.container.resolve(token)).toEqual({ value: 42 });
    await app.shutdown();
  });
});
