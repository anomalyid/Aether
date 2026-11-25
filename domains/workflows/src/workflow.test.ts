import { describe, expect, it, vi } from "vitest";
import { createMemoryWorkflowRepositories, createMemorySecurityRepositories } from "@aether/database";
import { ApprovalEngine, type PermissionProvider } from "@aether/security";
import { InMemoryEventBus } from "@aether/events";
import {
  WorkflowEngine,
  type StepExecutorPort,
  type WorkflowDefinition,
} from "./index";

function siapkan() {
  const repo = createMemoryWorkflowRepositories();
  const repoSec = createMemorySecurityRepositories();
  const izin = new Map<string, string[]>();
  const provider: PermissionProvider = {
    getPermissions: async (id, tenantId) => izin.get(`${tenantId}:${id}`) ?? [],
  };
  const approval = new ApprovalEngine(repoSec.approvals, provider);
  const executor = vi.fn(async (_step: unknown, context: Record<string, unknown>) => ({
    dari: context.mulai,
  }));
  const bus = new InMemoryEventBus();
  const events: string[] = [];
  bus.subscribe("*", async (event) => { events.push(event.type); });

  const buatEngine = () =>
    new WorkflowEngine({
      definitions: repo.definitions,
      runs: repo.runs,
      executor: { execute: executor } as StepExecutorPort,
      approvals: approval,
      events: bus,
    });

  const daftar = async (steps: WorkflowDefinition["steps"], overrides: Partial<WorkflowDefinition> = {}) => {
    const definition: WorkflowDefinition = {
      id: "alur-uji",
      version: "1.0.0",
      name: "Alur Uji",
      steps,
      enabled: true,
      ...overrides,
    };
    await repo.definitions.save(definition);
    return definition;
  };

  const mulai = (engine: WorkflowEngine, input: Record<string, unknown> = { mulai: "awal" }) =>
    engine.start({
      definitionId: "alur-uji",
      tenantId: "tenant_a",
      principalId: "prin_1",
      input,
    });

  return { repo, repoSec, izin, provider, approval, executor, events, buatEngine, daftar, mulai };
}

describe("Workflow Engine", () => {
  it("menjalankan langkah berurutan dan meneruskan context", async () => {
    const ctx = siapkan();
    await ctx.daftar([
      { id: "satu", type: "action", name: "Pertama", capabilityId: "cap.a", outputKey: "hasil" },
      { id: "dua", type: "transform", name: "Kedua", input: { nilai: "${{hasil}}" }, outputKey: "akhir" },
    ]);

    const run = await ctx.mulai(ctx.buatEngine());
    expect(run.state).toBe("COMPLETED");
    expect(run.completedStepIds).toEqual(["satu", "dua"]);
    expect(run.context.hasil).toEqual({ dari: "awal" });
    expect(ctx.events).toContain("workflow.completed");
  });

  it("melanjutkan run setelah restart tanpa mengulang langkah selesai", async () => {
    const ctx = siapkan();
    await ctx.daftar([
      { id: "satu", type: "action", name: "Pertama", capabilityId: "cap.a" },
      { id: "dua", type: "action", name: "Kedua", capabilityId: "cap.b" },
    ]);

    ctx.executor.mockImplementationOnce(async () => { throw new Error("gagal sementara"); });
    const enginePertama = ctx.buatEngine();
    await expect(ctx.mulai(enginePertama)).rejects.toThrow(/gagal sementara/);

    ctx.executor.mockClear();
    const engineBaru = ctx.buatEngine();
    const run = await engineBaru.resume(
      (await ctx.repo.runs.listByTenant("tenant_a"))[0]!.id,
      "tenant_a",
    );
    expect(run.state).toBe("COMPLETED");
    expect(run.completedStepIds).toEqual(["satu", "dua"]);
    expect(ctx.executor).toHaveBeenCalledTimes(2);
  });

  it("mencoba ulang sesuai konfigurasi retry", async () => {
    const ctx = siapkan();
    await ctx.daftar([
      {
        id: "satu",
        type: "action",
        name: "Pertama",
        capabilityId: "cap.a",
        retry: { maxAttempts: 3, backoffMs: 1 },
      },
    ]);
    ctx.executor
      .mockRejectedValueOnce(new Error("coba 1"))
      .mockRejectedValueOnce(new Error("coba 2"));

    const run = await ctx.mulai(ctx.buatEngine());
    expect(run.state).toBe("COMPLETED");
    expect(ctx.executor).toHaveBeenCalledTimes(3);
  });

  it("menghentikan run lipat gagal setelah retry habis", async () => {
    const ctx = siapkan();
    await ctx.daftar([
      {
        id: "satu",
        type: "action",
        name: "Pertama",
        capabilityId: "cap.a",
        retry: { maxAttempts: 2, backoffMs: 1 },
      },
    ]);
    ctx.executor.mockRejectedValue(new Error("gagal terus"));

    await expect(ctx.mulai(ctx.buatEngine())).rejects.toThrow(/gagal terus/);
    expect(ctx.events).toContain("workflow.failed");
  });

  it("menunggu approval lalu dilanjutkan", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:approver", ["approval.grant"]);
    await ctx.daftar([
      {
        id: "kirim",
        type: "approval",
        name: "Kirim pesan",
        capabilityId: "messaging.send",
        riskLevel: "high",
        input: { destination: "62812" },
      },
    ]);

    const engine = ctx.buatEngine();
    const first = await ctx.mulai(engine);
    expect(first.state).toBe("WAITING_APPROVAL");
    expect(first.approvalId).toMatch(/^appr_/);

    const approvalId = first.approvalId as string;
    await ctx.approval.approve(approvalId, "tenant_a", "approver");
    const resumed = await engine.resume(first.id, "tenant_a", approvalId);
    expect(resumed.state).toBe("COMPLETED");
    expect(resumed.completedStepIds).toContain("kirim");
  });

  it("membatalkan run", async () => {
    const ctx = siapkan();
    await ctx.daftar([
      {
        id: "kirim",
        type: "approval",
        name: "Kirim",
        capabilityId: "messaging.send",
      },
    ]);
    const engine = ctx.buatEngine();
    const run = await ctx.mulai(engine);
    const cancelled = await engine.cancel(run.id, "tenant_a");
    expect(cancelled.state).toBe("CANCELLED");
  });

  it("menolak akses lintas tenant", async () => {
    const ctx = siapkan();
    await ctx.daftar([{ id: "satu", type: "action", name: "Pertama" }]);
    const run = await ctx.mulai(ctx.buatEngine());
    await expect(ctx.buatEngine().cancel(run.id, "tenant_b")).rejects.toThrow(/tidak tersedia/);
  });
});
