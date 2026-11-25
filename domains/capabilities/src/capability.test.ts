import { describe, expect, it, vi } from "vitest";
import {
  createMemoryCapabilityRepositories,
  createMemorySecurityRepositories,
} from "@aether/database";
import {
  ApprovalEngine,
  AuditService,
  PolicyEngine,
  type PermissionProvider,
} from "@aether/security";
import {
  CapabilityEngine,
  CapabilityRegistry,
  type CapabilityDefinition,
  type DomainEvent,
  type InvocationRequest,
  type PolicyEvaluatorPort,
} from "./index";

function siapkan() {
  const repoCap = createMemoryCapabilityRepositories();
  const repoSec = createMemorySecurityRepositories();
  const izin = new Map<string, string[]>();
  const provider: PermissionProvider = {
    getPermissions: async (principalId, tenantId) => izin.get(`${tenantId}:${principalId}`) ?? [],
  };

  const policy = new PolicyEngine(repoSec.policies, provider);
  const approval = new ApprovalEngine(repoSec.approvals, provider);
  const audit = new AuditService(repoSec.audit);
  const events: DomainEvent[] = [];
  const executor = vi.fn(async () => ({ messageId: "msg_1", status: "sent" }));
  const registry = new CapabilityRegistry(repoCap.capabilities);

  const engine = new CapabilityEngine({
    registry,
    executor: { execute: executor },
    policy: policy as PolicyEvaluatorPort,
    approvals: approval,
    audit,
    events: { publish: async (event) => { events.push(event); } },
    idempotency: repoCap.idempotency,
  });

  const daftar = async (overrides: Partial<CapabilityDefinition> = {}) => {
    const definition: CapabilityDefinition = {
      id: "messaging.send",
      version: "1.0.0",
      name: "Kirim Pesan",
      description: "Mengirim pesan melalui provider terizinkan",
      inputSchema: {
        type: "object",
        required: ["destination", "content"],
        properties: {
          destination: { type: "string", minLength: 3 },
          content: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        required: ["messageId", "status"],
        properties: {
          messageId: { type: "string" },
          status: { type: "string" },
        },
      },
      riskLevel: "low",
      permissions: ["messaging.send"],
      idempotency: "supported",
      timeoutMs: 1000,
      owner: "aether.connect",
      provider: "whatsapp",
      enabled: true,
      ...overrides,
    };
    await registry.register(definition);
    return definition;
  };

  const izinkan = async () => {
    izin.set("tenant_a:prin_agent", ["capability.invoke", "messaging.send"]);
    await repoSec.policies.save({
      id: "pol_allow",
      effect: "allow",
      actions: ["capability.*"],
      priority: 100,
      enabled: true,
    });
  };

  const permintaan = (overrides: Partial<InvocationRequest> = {}): InvocationRequest => ({
    capabilityId: "messaging.send",
    input: { destination: "628123456789", content: "Halo" },
    principal: { tenantId: "tenant_a", principalId: "prin_agent", actorType: "agent" },
    tenantId: "tenant_a",
    ...overrides,
  });

  return {
    repoCap,
    repoSec,
    izin,
    provider,
    policy,
    approval,
    audit,
    events,
    executor,
    engine,
    daftar,
    izinkan,
    permintaan,
  };
}

describe("Capability Engine", () => {
  it("menjalankan pipeline lengkap pada operasi risiko rendah", async () => {
    const ctx = siapkan();
    await ctx.daftar();
    await ctx.izinkan();

    const result = await ctx.engine.invoke(ctx.permintaan());
    expect(result.status).toBe("completed");
    expect(result.output).toEqual({ messageId: "msg_1", status: "sent" });
    expect(result.auditId).toMatch(/^audit_/);
    expect(ctx.events.some((event) => event.type === "capability.invoked")).toBe(true);
    expect(await ctx.audit.list("tenant_a")).toHaveLength(1);
  });

  it("menolak input yang tidak sesuai schema", async () => {
    const ctx = siapkan();
    await ctx.daftar();
    await ctx.izinkan();

    await expect(
      ctx.engine.invoke(ctx.permintaan({ input: { destination: "1", content: "" } })),
    ).rejects.toThrow(/Input capability tidak valid/);
    expect(ctx.executor).not.toHaveBeenCalled();
  });

  it("menolak ketika permission tidak tersedia", async () => {
    const ctx = siapkan();
    await ctx.daftar();
    await ctx.repoSec.policies.save({
      id: "pol_allow",
      effect: "allow",
      actions: ["capability.*"],
      priority: 100,
      enabled: true,
    });

    await expect(ctx.engine.invoke(ctx.permintaan())).rejects.toThrow(/tidak diizinkan/);
    await expect(ctx.audit.list("tenant_a")).resolves.toHaveLength(1);
  });

  it("memblokir ketika policy deny berlaku", async () => {
    const ctx = siapkan();
    await ctx.daftar();
    await ctx.izinkan();
    await ctx.repoSec.policies.save({
      id: "pol_deny",
      effect: "deny",
      actions: ["capability.*"],
      priority: 999,
      enabled: true,
    });

    await expect(ctx.engine.invoke(ctx.permintaan())).rejects.toThrow(/tidak diizinkan/);
  });

  it("meminta approval untuk capability berisiko tinggi", async () => {
    const ctx = siapkan();
    await ctx.daftar({ riskLevel: "high" });
    await ctx.izinkan();

    const first = await ctx.engine.invoke(ctx.permintaan());
    expect(first.status).toBe("awaiting_approval");
    expect(first.approvalId).toMatch(/^appr_/);
    expect(ctx.executor).not.toHaveBeenCalled();

    ctx.izin.set("tenant_a:approver", ["approval.grant"]);
    await ctx.approval.approve(first.approvalId as string, "tenant_a", "approver");

    const second = await ctx.engine.invoke(
      ctx.permintaan({ approvalId: first.approvalId }),
    );
    expect(second.status).toBe("completed");
  });

  it("menolak approval jika parameter berubah", async () => {
    const ctx = siapkan();
    await ctx.daftar({ riskLevel: "high" });
    await ctx.izinkan();
    ctx.izin.set("tenant_a:approver", ["approval.grant"]);

    const first = await ctx.engine.invoke(ctx.permintaan());
    await ctx.approval.approve(first.approvalId as string, "tenant_a", "approver");

    await expect(
      ctx.engine.invoke(
        ctx.permintaan({
          approvalId: first.approvalId,
          input: { destination: "628999999999", content: "Halo" },
        }),
      ),
    ).rejects.toThrow(/Parameter berubah/);
  });

  it("mengembalikan hasil cache untuk idempotency key yang sama", async () => {
    const ctx = siapkan();
    await ctx.daftar();
    await ctx.izinkan();

    const first = await ctx.engine.invoke(ctx.permintaan({ idempotencyKey: "kunci-1" }));
    const second = await ctx.engine.invoke(ctx.permintaan({ idempotencyKey: "kunci-1" }));

    expect(second.replayed).toBe(true);
    expect(second.output).toEqual(first.output);
    expect(ctx.executor).toHaveBeenCalledOnce();
  });

  it("mendeteksi konflik idempotency", async () => {
    const ctx = siapkan();
    await ctx.daftar();
    await ctx.izinkan();

    await ctx.engine.invoke(ctx.permintaan({ idempotencyKey: "kunci-2" }));
    await expect(
      ctx.engine.invoke(
        ctx.permintaan({
          idempotencyKey: "kunci-2",
          input: { destination: "628123456789", content: "Berbeda" },
        }),
      ),
    ).rejects.toThrow(/Idempotency key/);
  });

  it("mencatat kegagalan provider dan menerbitkan event gagal", async () => {
    const ctx = siapkan();
    await ctx.daftar();
    await ctx.izinkan();
    ctx.executor.mockRejectedValueOnce(new Error("provider mati"));

    await expect(ctx.engine.invoke(ctx.permintaan())).rejects.toThrow(/provider mati/);
    expect(ctx.events.some((event) => event.type === "capability.failed")).toBe(true);
    expect((await ctx.audit.list("tenant_a"))[0]?.outcome).toBe("failed");
  });

  it("menyembunyikan capability tenant-specific dari tenant lain", async () => {
    const ctx = siapkan();
    await ctx.daftar({ tenantId: "tenant_a" });
    await ctx.izinkan();

    await expect(
      ctx.engine.invoke(
        ctx.permintaan({
          tenantId: "tenant_b",
          principal: { tenantId: "tenant_b", principalId: "prin_agent", actorType: "agent" },
        }),
      ),
    ).rejects.toThrow(/tidak tersedia dalam tenant ini/);
  });

  it("menghentikan eksekusi yang melewati timeout", async () => {
    const ctx = siapkan();
    await ctx.daftar({ timeoutMs: 5 });
    await ctx.izinkan();
    ctx.executor.mockImplementationOnce(
      () => new Promise((_resolve) => setTimeout(_resolve, 100)),
    );

    await expect(ctx.engine.invoke(ctx.permintaan())).rejects.toThrow(/melebihi batas/);
  }, 5000);
});
