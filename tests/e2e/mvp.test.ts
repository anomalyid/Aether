/**
 * MVP GATE — membuktikan seluruh fondasi Aether bekerja dalam satu alur.
 *
 * Event → Normalisasi → Agent → Skill → Capability → Authorization
 * → Approval → Execution → Validasi → Audit + Observability → Hasil.
 *
 * By Anomalyid.
 */

import { describe, expect, it, vi } from "vitest";
import {
  createMemoryAgentRepositories,
  createMemoryCapabilityRepositories,
  createMemoryIdentityRepositories,
  MemoryOutboxStore,
  createMemorySecurityRepositories,
} from "@aether/database";
import {
  MembershipService,
  PrincipalService,
  RoleService,
  TenantService,
  UserService,
} from "@aether/identity";
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
} from "@aether/capabilities";
import {
  AgentRuntime,
  ContextEngine,
  ModelGateway,
  type ModelResponse,
} from "@aether/agents";
import { SkillRegistry } from "@aether/skills";
import {
  InMemoryEventBus,
  OutboxPublisher,
  createEvent,
} from "@aether/events";
import {
  normalizeCloudWebhook,
} from "@aether/provider-whatsapp";

const skillMarkdown = `---
name: customer-support
description: Membantu agen membalas pesan pelanggan dengan aman dan meminta approval.
---

# Customer Support

1. Pahami pesan pelanggan.
2. Siapkan balasan singkat.
3. Minta approval sebelum mengirim.
`;

const webhook = {
  object: "whatsapp_business_account",
  entry: [{
    changes: [{
      field: "messages",
      value: {
        metadata: { phone_number_id: "106540352242922" },
        contacts: [{ wa_id: "16505551234", user_id: "US.123", profile: { name: "Sheena" } }],
        messages: [{
          id: "wamid.MVP123",
          from: "16505551234",
          from_user_id: "US.123",
          timestamp: "1749416383",
          type: "text",
          text: { body: "Halo, saya butuh bantuan" },
        }],
      },
    }],
  }],
};

describe("Aether MVP Gate", () => {
  it("menjalankan alur lengkap dari event hingga audit", async () => {
    // ---- Identity & data foundation ----
    const identity = createMemoryIdentityRepositories();
    const tenantService = new TenantService(identity.tenants);
    const userService = new UserService(identity.users);
    const roleService = new RoleService(identity.roles, identity.tenants);
    const membershipService = new MembershipService(
      identity.memberships,
      identity.tenants,
      identity.users,
      identity.roles,
    );
    const principalService = new PrincipalService(identity.principals, identity.tenants);

    const tenant = await tenantService.create({ name: "Anomalyid", slug: "anomalyid" });
    const user = await userService.create({ email: "ibra@example.com", displayName: "Ibra" });
    const role = await roleService.create({ tenantId: tenant.id, name: "member" });
    await roleService.grantPermission(tenant.id, role.id, "capability.invoke", "Memanggil capability");
    await roleService.grantPermission(tenant.id, role.id, "messaging.send", "Mengirim pesan");
    await roleService.grantPermission(tenant.id, role.id, "approval.grant", "Menyetujui aksi");
    await membershipService.addMember({ tenantId: tenant.id, userId: user.id, roleId: role.id });
    const principal = await principalService.forUser(user.id, tenant.id);

    const provider: PermissionProvider = {
      getPermissions: async (principalId, tenantId) => {
        const resolved = await principalService.assertInTenant(principalId, tenantId);
        return membershipService.getPermissions(resolved.subjectId, tenantId);
      },
    };

    // ---- Security & trust ----
    const security = createMemorySecurityRepositories();
    const policy = new PolicyEngine(security.policies, provider);
    const approval = new ApprovalEngine(security.approvals, provider);
    const audit = new AuditService(security.audit);
    await security.policies.save({
      id: "pol_send",
      effect: "allow",
      actions: ["capability.*"],
      priority: 100,
      enabled: true,
    });

    // ---- Capability infrastructure ----
    const capabilityRepo = createMemoryCapabilityRepositories();
    const registry = new CapabilityRegistry(capabilityRepo.capabilities);
    const definition: CapabilityDefinition = {
      id: "messaging.send",
      version: "1.0.0",
      name: "Kirim Pesan",
      description: "Mengirim pesan melalui provider terizinkan",
      inputSchema: {
        type: "object",
        required: ["destination", "content"],
        properties: { destination: { type: "string" }, content: { type: "string" } },
      },
      outputSchema: {
        type: "object",
        required: ["messageId", "status"],
        properties: { messageId: { type: "string" }, status: { type: "string" } },
      },
      riskLevel: "high",
      permissions: ["messaging.send"],
      idempotency: "supported",
      timeoutMs: 1000,
      owner: "aether.connect",
      provider: "whatsapp.cloud-api",
      enabled: true,
    };
    await registry.register(definition);

    const executor = vi.fn(async () => ({ messageId: "wamid.BALASAN", status: "sent" }));
    const outbox = new MemoryOutboxStore();
    const events = new InMemoryEventBus();
    const capabilityEngine = new CapabilityEngine({
      registry,
      executor: { execute: executor },
      policy,
      approvals: approval,
      audit,
      events: { publish: async (event) => outbox.add(event) },
      idempotency: capabilityRepo.idempotency,
    });

    // ---- Skills ----
    const skills = new SkillRegistry();
    skills.register({
      folderName: "customer-support",
      raw: skillMarkdown,
      trust: "organization",
    });
    expect(skills.catalog()[0]?.name).toBe("customer-support");
    const skillInstructions = skills.load("customer-support");
    expect(skillInstructions).toContain("Minta approval");

    // ---- Event masuk & normalisasi ----
    const normalized = normalizeCloudWebhook(webhook, {
      tenantId: tenant.id,
      integrationId: "integration_whatsapp",
    });
    expect(normalized).toHaveLength(1);
    const event = createEvent({
      type: "message.received",
      tenantId: tenant.id,
      correlationId: "corr_mvp",
      source: "integration.whatsapp",
      data: { message: normalized[0] as unknown as Record<string, unknown> },
    });
    let receivedEvent: DomainEvent | undefined;
    events.subscribe("message.received", async (incoming) => {
      receivedEvent = incoming;
    });
    await outbox.add(event);
    expect(await new OutboxPublisher(outbox, events).drain()).toBe(1);
    expect(receivedEvent?.id).toBe(event.id);

    // ---- Agent runtime ----
    const models = new ModelGateway();
    let callCount = 0;
    const toolResponse: ModelResponse = {
      text: "",
      model: "uji",
      provider: "uji",
      finishReason: "tool_calls",
      usage: { inputTokens: 20, outputTokens: 10, estimatedCost: 0.01 },
      toolCalls: [{
        name: "messaging.send",
        arguments: { destination: "16505551234", content: "Halo, kami siap membantu." },
        callId: "call_mvp_1",
      }],
    };
    const finalResponse: ModelResponse = {
      text: "Pesan dikirim setelah approval.",
      model: "uji",
      provider: "uji",
      finishReason: "stop",
      usage: { inputTokens: 20, outputTokens: 5, estimatedCost: 0.01 },
    };
    models.register({
      id: "uji",
      generate: async () => {
        callCount += 1;
        return callCount <= 2 ? toolResponse : finalResponse;
      },
    });

    const agentRepo = createMemoryAgentRepositories();
    await agentRepo.definitions.save({
      id: "customer-assistant",
      version: "1.0.0",
      name: "Customer Assistant",
      description: "Membalas pesan pelanggan",
      instructions: skillInstructions,
      skills: ["customer-support"],
      capabilities: { allowed: ["messaging.send"] },
      model: { profile: "balanced" },
      limits: { maxDurationMs: 5000, maxSteps: 5, maxModelCalls: 3, maxToolCalls: 3 },
      security: { approvalPolicy: "default" },
      enabled: true,
    });

    const runtime = new AgentRuntime({
      definitions: agentRepo.definitions,
      runs: agentRepo.runs,
      models,
      context: new ContextEngine(),
      capabilities: { invoke: (request) => capabilityEngine.invoke(request) },
      audit,
      events: { publish: async (domainEvent) => outbox.add(domainEvent) },
    });

    const first = await runtime.start({
      agentId: "customer-assistant",
      tenantId: tenant.id,
      principalId: principal.id,
      input: { pesan: normalized[0]?.content.text ?? "" },
      correlationId: event.correlationId,
    });

    // Capability berisiko tinggi tidak boleh langsung tereksekusi.
    expect(first.state, JSON.stringify(first.error)).toBe("WAITING_APPROVAL");
    expect(executor).not.toHaveBeenCalled();

    // Approval terikat parameter yang sama persis.
    await approval.approve(first.approvalId as string, tenant.id, principal.id);
    const final = await runtime.resume(first.id, tenant.id, first.approvalId as string);

    expect(final.state).toBe("COMPLETED");
    expect(executor).toHaveBeenCalledOnce();
    expect(executor.mock.calls[0]?.[1]).toMatchObject({
      destination: "16505551234",
      content: "Halo, kami siap membantu.",
    });
    expect(final.correlationId).toBe("corr_mvp");

    // ---- Audit, trace, dan isolasi tenant ----
    const logs = await audit.list(tenant.id);
    expect(logs.some((entry) => entry.outcome === "allowed" || entry.outcome === "approval")).toBe(true);
    expect(logs.some((entry) => entry.outcome === "executed")).toBe(true);
    expect(await audit.list("tenant_lain")).toHaveLength(0);

    const published = await outbox.pending(100);
    expect(published.some((record) => record.event.type === "capability.invoked")).toBe(true);
    expect(published.some((record) => record.event.type === "agent.run.completed")).toBe(true);
  }, 10_000);
});
