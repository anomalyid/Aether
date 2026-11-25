/**
 * Composition root untuk API Aether (development/default).
 *
 * Memakai adapter in-memory agar API dapat diuji tanpa infrastruktur eksternal.
 * Deployment produksi mengganti adapter dengan PostgreSQL/Redis/vault.
 *
 * By Anomalyid.
 */

import {
  createMemoryAgentRepositories,
  createMemoryCapabilityRepositories,
  createMemoryIdentityRepositories,
  createMemorySecurityRepositories,
  MemoryOutboxStore,
} from "@aether/database";
import {
  MembershipService,
  PrincipalService,
  RoleService,
  TenantService,
  UserService,
  type Tenant,
  type User,
  type Principal,
} from "@aether/identity";
import {
  ApprovalEngine,
  AuditService,
  PolicyEngine,
  type PermissionProvider,
  type PolicyRepository,
} from "@aether/security";
import {
  CapabilityEngine,
  CapabilityRegistry,
  type CapabilityDefinition,
} from "@aether/capabilities";
import {
  AgentRuntime,
  ContextEngine,
  ModelGateway,
  type AgentDefinition,
  type AgentDefinitionRepository,
  type ModelResponse,
} from "@aether/agents";
import { SkillRegistry } from "@aether/skills";
import { InMemoryEventBus } from "@aether/events";

export interface AetherServices {
  policies: PolicyRepository;
  agentDefinitions: AgentDefinitionRepository;
  tenants: TenantService;
  users: UserService;
  roles: RoleService;
  memberships: MembershipService;
  principals: PrincipalService;
  policy: PolicyEngine;
  approvals: ApprovalEngine;
  audit: AuditService;
  capabilityRegistry: CapabilityRegistry;
  capabilities: CapabilityEngine;
  models: ModelGateway;
  runtime: AgentRuntime;
  skills: SkillRegistry;
  events: InMemoryEventBus;
  outbox: MemoryOutboxStore;
}

export function createMemoryServices(): AetherServices {
  const identity = createMemoryIdentityRepositories();
  const security = createMemorySecurityRepositories();
  const capabilityRepo = createMemoryCapabilityRepositories();
  const agentRepo = createMemoryAgentRepositories();

  const tenants = new TenantService(identity.tenants);
  const users = new UserService(identity.users);
  const roles = new RoleService(identity.roles, identity.tenants);
  const memberships = new MembershipService(
    identity.memberships,
    identity.tenants,
    identity.users,
    identity.roles,
  );
  const principals = new PrincipalService(identity.principals, identity.tenants);

  const provider: PermissionProvider = {
    getPermissions: async (principalId, tenantId) => {
      const principal = await principals.assertInTenant(principalId, tenantId);
      return memberships.getPermissions(principal.subjectId, tenantId);
    },
  };

  const policy = new PolicyEngine(security.policies, provider);
  const approvals = new ApprovalEngine(security.approvals, provider);
  const audit = new AuditService(security.audit);
  const events = new InMemoryEventBus();
  const outbox = new MemoryOutboxStore();

  const capabilityRegistry = new CapabilityRegistry(capabilityRepo.capabilities);
  const capabilities = new CapabilityEngine({
    registry: capabilityRegistry,
    executor: {
      execute: async (capabilityId, input) => ({
        capabilityId,
        destination: input.destination,
        status: "sent",
        messageId: `msg_${capabilityId}_${Date.now().toString(36)}`,
      }),
    },
    policy,
    approvals,
    audit,
    events: { publish: (event) => outbox.add(event) },
    idempotency: capabilityRepo.idempotency,
  });

  const models = new ModelGateway();
  const fixedResponse: ModelResponse = {
    text: "Tugas selesai.",
    model: "demo-model",
    provider: "demo-provider",
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 5, estimatedCost: 0.001 },
  };
  models.register({ id: "demo-provider", generate: async () => fixedResponse });

  const runtime = new AgentRuntime({
    definitions: agentRepo.definitions,
    runs: agentRepo.runs,
    models,
    context: new ContextEngine(),
    capabilities: { invoke: (request) => capabilities.invoke(request) },
    audit,
    events: { publish: (event) => outbox.add(event) },
  });

  const skills = new SkillRegistry();

  return {
    policies: security.policies,
    agentDefinitions: agentRepo.definitions,
    tenants,
    users,
    roles,
    memberships,
    principals,
    policy,
    approvals,
    audit,
    capabilityRegistry,
    capabilities,
    models,
    runtime,
    skills,
    events,
    outbox,
  };
}

export interface DemoFixture {
  tenant: Tenant;
  user: User;
  principal: Principal;
}

/** Data contoh agar endpoint dapat dicoba tanpa setup manual. */
export async function seedDemo(services: AetherServices): Promise<DemoFixture> {
  const tenant = await services.tenants.create({ name: "Anomalyid Demo", slug: "demo" });
  const user = await services.users.create({
    email: "demo@anomalyid.id",
    displayName: "Demo User",
  });
  const role = await services.roles.create({ tenantId: tenant.id, name: "member" });
  for (const permission of [
    "capability.invoke",
    "messaging.send",
    "approval.grant",
    "skill.read",
  ]) {
    await services.roles.grantPermission(tenant.id, role.id, permission, `Izin ${permission}`);
  }
  await services.memberships.addMember({
    tenantId: tenant.id,
    userId: user.id,
    roleId: role.id,
  });
  const principal = await services.principals.forUser(user.id, tenant.id);

  await services.policies.save({
    id: "pol_demo",
    effect: "allow",
    actions: ["capability.*"],
    priority: 100,
    enabled: true,
  });

  const capability: CapabilityDefinition = {
    id: "messaging.send",
    version: "1.0.0",
    name: "Kirim Pesan",
    description: "Mengirim pesan melalui provider terizinkan",
    inputSchema: {
      type: "object",
      required: ["destination", "content"],
      properties: {
        destination: { type: "string", minLength: 1 },
        content: { type: "string", minLength: 1 },
      },
    },
    outputSchema: { type: "object", properties: { messageId: { type: "string" } } },
    riskLevel: "low",
    permissions: ["messaging.send"],
    idempotency: "supported",
    timeoutMs: 1000,
    owner: "aether.connect",
    provider: "whatsapp.cloud-api",
    enabled: true,
  };
  await services.capabilityRegistry.register(capability);

  const agent: AgentDefinition = {
    id: "demo-agent",
    version: "1.0.0",
    name: "Demo Agent",
    description: "Agent contoh untuk API",
    instructions: "Jawab dengan singkat dan aman.",
    skills: ["customer-support"],
    capabilities: { allowed: ["messaging.send"] },
    model: { profile: "balanced" },
    limits: { maxDurationMs: 5000, maxSteps: 5, maxModelCalls: 3, maxToolCalls: 3 },
    security: { approvalPolicy: "default" },
    enabled: true,
  };
  await services.agentDefinitions.save(agent);

  services.skills.register({
    folderName: "customer-support",
    raw: `---\nname: customer-support\ndescription: Membantu agen membalas pesan pelanggan dengan aman.\n---\n\n# Customer Support\n\n1. Pahami pesan.\n2. Siapkan balasan.\n`,
    trust: "organization",
  });

  return { tenant, user, principal };
}
