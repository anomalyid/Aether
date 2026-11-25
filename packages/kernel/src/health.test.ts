import { describe, expect, it } from "vitest";
import { HealthManager } from "./health";

describe("health manager", () => {
  it("liveness selalu sehat selama proses aktif", async () => {
    const manager = new HealthManager();
    const report = await manager.liveness();
    expect(report.status).toBe("healthy");
    expect(report.components[0]?.id).toBe("process");
  });

  it("readiness tidak sehat sebelum ditandai siap", async () => {
    const manager = new HealthManager();
    expect((await manager.readiness()).status).toBe("unhealthy");
    manager.setReady(true);
    expect((await manager.readiness()).status).toBe("healthy");
  });

  it("mengambil status terburuk dari semua komponen", async () => {
    const manager = new HealthManager();
    manager.setReady(true);
    manager.register("db", async () => ({
      status: "degraded",
      checkedAt: new Date().toISOString(),
    }));
    manager.register("queue", async () => ({
      status: "healthy",
      checkedAt: new Date().toISOString(),
    }));
    expect((await manager.report()).status).toBe("degraded");
  });

  it("mengubah health check yang melempar menjadi unhealthy", async () => {
    const manager = new HealthManager();
    manager.register("rusak", async () => {
      throw new Error("koneksi putus");
    });
    const report = await manager.dependencies();
    expect(report.status).toBe("unhealthy");
    expect(report.components[0]?.message).toContain("koneksi putus");
  });

  it("menghapus detail sensitif dari health report", async () => {
    const manager = new HealthManager();
    manager.register("adapter", async () => ({
      status: "degraded",
      checkedAt: new Date().toISOString(),
      details: {
        apiToken: "sk-abcdefghijklmnopqrstuvwxyz123456",
        host: "internal.example",
      },
    }));
    const report = await manager.dependencies();
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(serialized).toContain("[REDACTED]");
  });
});
