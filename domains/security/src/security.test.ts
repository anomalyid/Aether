import { describe, expect, it } from "vitest";
import { createMemorySecurityRepositories } from "@aether/database";
import {
  ApprovalEngine,
  AuditService,
  DelegationService,
  PolicyEngine,
  parameterDigest,
  type AuthorizationRequest,
  type PermissionProvider,
  type Policy,
} from "./index";

function siapkan() {
  const repo = createMemorySecurityRepositories();
  const izin = new Map<string, string[]>();
  const provider: PermissionProvider = {
    getPermissions: async (principalId, tenantId) =>
      izin.get(`${tenantId}:${principalId}`) ?? [],
  };
  return {
    repo,
    izin,
    provider,
    policy: new PolicyEngine(repo.policies, provider),
    delegasi: new DelegationService(provider, repo.delegations),
    approval: new ApprovalEngine(repo.approvals, provider),
    audit: new AuditService(repo.audit),
  };
}

const permintaan = (overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest => ({
  principal: { tenantId: "tenant_a", principalId: "prin_agent", actorType: "agent" },
  action: "capability.invoke",
  resource: "whatsapp_account_456",
  capability: "messaging.send",
  riskLevel: "low",
  ...overrides,
});

const kebijakan = (overrides: Partial<Policy> = {}): Policy => ({
  id: "pol_utama",
  effect: "allow",
  actions: ["capability.*"],
  priority: 100,
  enabled: true,
  ...overrides,
});

describe("Policy Engine", () => {
  it("menolak ketika permission tidak dimiliki", async () => {
    const { policy } = siapkan();
    const result = await policy.evaluate(permintaan());
    expect(result.decision).toBe("deny");
    expect(result.reasonCode).toBe("PERMISSION_MISSING");
  });

  it("mengizinkan operasi risiko rendah ketika policy dan izin cocok", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:prin_agent", ["capability.invoke", "messaging.send"]);
    await ctx.repo.policies.save(kebijakan());

    const result = await ctx.policy.evaluate(permintaan());
    expect(result.decision).toBe("allow");
    expect(result.reasonCode).toBe("ALLOWED");
  });

  it("deny selalu mengalahkan allow", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:prin_agent", ["capability.invoke", "messaging.send"]);
    await ctx.repo.policies.save(kebijakan());
    await ctx.repo.policies.save(kebijakan({
      id: "pol_deny",
      effect: "deny",
      priority: 999,
    }));

    const result = await ctx.policy.evaluate(permintaan());
    expect(result.decision).toBe("deny");
    expect(result.reasonCode).toBe("POLICY_DENIED");
  });

  it("memaksa approval untuk risiko tinggi meski policy mengizinkan", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:prin_agent", ["capability.invoke", "messaging.send"]);
    await ctx.repo.policies.save(kebijakan());

    const result = await ctx.policy.evaluate(permintaan({ riskLevel: "critical" }));
    expect(result.decision).toBe("require_approval");
    expect(result.reasonCode).toBe("RISK_REQUIRES_APPROVAL");
  });

  it("mengevaluasi kondisi ABAC", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:prin_agent", ["capability.invoke", "messaging.send"]);
    await ctx.repo.policies.save(kebijakan({
      conditions: [{ attribute: "amount", operator: "gt", value: 100 }],
    }));

    const ditolak = await ctx.policy.evaluate(permintaan({ attributes: { amount: 50 } }));
    const diterima = await ctx.policy.evaluate(permintaan({ attributes: { amount: 500 } }));
    expect(ditolak.decision).toBe("deny");
    expect(diterima.decision).toBe("allow");
  });

  it("default deny ketika tidak ada policy yang cocok", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:prin_agent", ["capability.invoke", "messaging.send"]);
    expect((await ctx.policy.evaluate(permintaan())).reasonCode).toBe("NO_MATCHING_POLICY");
  });

  it("tidak memakai policy tenant lain", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:prin_agent", ["capability.invoke", "messaging.send"]);
    await ctx.repo.policies.save(kebijakan({ tenantId: "tenant_b" }));

    expect((await ctx.policy.evaluate(permintaan())).decision).toBe("deny");
  });
});

describe("Delegation Service", () => {
  it("membuat delegasi untuk subset izin", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:user_1", ["capability.invoke", "messaging.send", "tenant.manage"]);
    const delegation = await ctx.delegasi.create({
      tenantId: "tenant_a",
      fromPrincipalId: "user_1",
      toPrincipalId: "agent_1",
      permissions: ["capability.invoke", "messaging.send"],
      capabilityScope: "messaging.send",
    });

    expect(delegation.permissions).toEqual(["capability.invoke", "messaging.send"]);
    expect(await ctx.delegasi.effectivePermissions(delegation.id, "tenant_a")).toHaveLength(2);
  });

  it("menolak agent yang memperluas izin", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:user_1", ["capability.invoke"]);
    await expect(
      ctx.delegasi.create({
        tenantId: "tenant_a",
        fromPrincipalId: "user_1",
        toPrincipalId: "agent_1",
        permissions: ["tenant.manage"],
      }),
    ).rejects.toThrow(/memperluas izin/);
  });

  it("mencabut delegasi", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:user_1", ["capability.invoke"]);
    const delegation = await ctx.delegasi.create({
      tenantId: "tenant_a",
      fromPrincipalId: "user_1",
      toPrincipalId: "agent_1",
      permissions: ["capability.invoke"],
    });
    await ctx.delegasi.revoke(delegation.id, "tenant_a");
    await expect(ctx.delegasi.assertValid(delegation.id, "tenant_a")).rejects.toThrow(/dicabut/);
  });

  it("mendeteksi delegasi kedaluwarsa", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:user_1", ["capability.invoke"]);
    const delegation = await ctx.delegasi.create({
      tenantId: "tenant_a",
      fromPrincipalId: "user_1",
      toPrincipalId: "agent_1",
      permissions: ["capability.invoke"],
      ttlMs: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(ctx.delegasi.assertValid(delegation.id, "tenant_a")).rejects.toThrow(/kedaluwarsa/);
  });

  it("menolak capability di luar scope delegasi", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:user_1", ["capability.invoke", "messaging.send"]);
    const delegation = await ctx.delegasi.create({
      tenantId: "tenant_a",
      fromPrincipalId: "user_1",
      toPrincipalId: "agent_1",
      permissions: ["capability.invoke", "messaging.send"],
      capabilityScope: "messaging.send",
    });
    await expect(
      ctx.delegasi.assertValid(delegation.id, "tenant_a", "payment.send"),
    ).rejects.toThrow(/luar scope/);
  });
});

describe("Approval Engine", () => {
  const buat = (ctx: ReturnType<typeof siapkan>) =>
    ctx.approval.create({
      tenantId: "tenant_a",
      requesterPrincipalId: "prin_agent",
      agentRunId: "run_1",
      capabilityId: "messaging.send",
      resourceReference: "whatsapp_account_456",
      parameters: { destination: "62812", content: "Halo" },
      riskLevel: "high",
    });

  it("approval terikat pada parameter yang tepat", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:approver", ["approval.grant"]);
    const record = await buat(ctx);
    await ctx.approval.approve(record.id, "tenant_a", "approver");

    await expect(
      ctx.approval.assertApproved(record.id, "tenant_a", "messaging.send", {
        destination: "62812",
        content: "Halo",
      }),
    ).resolves.toBeUndefined();

    await expect(
      ctx.approval.assertApproved(record.id, "tenant_a", "messaging.send", {
        destination: "62813",
        content: "Halo",
      }),
    ).rejects.toThrow(/Parameter berubah/);
  });

  it("digest tidak bergantung pada urutan kunci", () => {
    expect(parameterDigest({ a: 1, b: 2 })).toBe(parameterDigest({ b: 2, a: 1 }));
  });

  it("menolak approver tanpa izin approval.grant", async () => {
    const ctx = siapkan();
    const record = await buat(ctx);
    await expect(
      ctx.approval.approve(record.id, "tenant_a", "approver_tanpa_izin"),
    ).rejects.toThrow(/approval.grant/);
  });

  it("approval kedaluwarsa memiliki state jelas", async () => {
    const ctx = siapkan();
    ctx.izin.set("tenant_a:approver", ["approval.grant"]);
    const record = await ctx.approval.create({
      tenantId: "tenant_a",
      requesterPrincipalId: "prin_agent",
      capabilityId: "messaging.send",
      resourceReference: "res_1",
      parameters: { a: 1 },
      riskLevel: "high",
      ttlMs: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(
      ctx.approval.approve(record.id, "tenant_a", "approver"),
    ).rejects.toThrow(/kedaluwarsa/);
    expect((await ctx.approval.get(record.id, "tenant_a")).state).toBe("expired");
  });

  it("menolak akses approval lintas tenant", async () => {
    const ctx = siapkan();
    const record = await buat(ctx);
    await expect(ctx.approval.get(record.id, "tenant_b")).rejects.toThrow(/tidak tersedia/);
  });
});

describe("Audit Service", () => {
  it("mencatat dan mengambil audit per tenant", async () => {
    const ctx = siapkan();
    await ctx.audit.record({
      tenantId: "tenant_a",
      principalId: "prin_agent",
      actorType: "agent",
      action: "capability.invoke",
      resource: "messaging.send",
      outcome: "executed",
      correlationId: "corr_1",
      details: { apiToken: "sk-abcdefghijklmnopqrstuvwxyz123456", aman: true },
    });

    const events = await ctx.audit.list("tenant_a");
    expect(events).toHaveLength(1);
    expect(events[0]?.outcome).toBe("executed");
    expect(await ctx.audit.list("tenant_b")).toHaveLength(0);
    expect(JSON.stringify(events)).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
  });
});
