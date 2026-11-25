import { describe, expect, it } from "vitest";
import {
  assertDelegationAllowed,
  createDelegationTask,
  validateAgentCard,
} from "./index";

const card = {
  name: "Recipe Agent",
  description: "Membantu resep dan memasak",
  supportedInterfaces: [{
    url: "https://api.example.com/a2a/v1",
    protocolBinding: "JSONRPC",
    protocolVersion: "1.0",
  }],
  version: "1.0.0",
  capabilities: { streaming: true },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [{ id: "resep", name: "Resep", description: "Menyusun resep" }],
};

describe("A2A Agent Card", () => {
  it("menerima card yang valid", () => {
    expect(() => validateAgentCard(card)).not.toThrow();
  });

  it("menolak card tanpa interface atau skill", () => {
    expect(() => validateAgentCard({ ...card, supportedInterfaces: [] })).toThrow(/supportedInterfaces/);
    expect(() => validateAgentCard({ ...card, skills: undefined })).toThrow(/Skills/);
    expect(() => validateAgentCard({ ...card, name: "" })).toThrow(/name/);
  });

  it("menolak URL non-HTTPS absolut", () => {
    expect(() =>
      validateAgentCard({
        ...card,
        supportedInterfaces: [{ ...card.supportedInterfaces[0], url: "bukan-url" }],
      }),
    ).toThrow(/URL/);
  });
});

describe("A2A Delegation", () => {
  const buat = () =>
    createDelegationTask({
      tenantId: "tenant_a",
      requestingAgent: "supervisor",
      receivingAgent: "researcher",
      scope: "knowledge.search",
      ttlMs: 60_000,
      budget: { maxSteps: 5, maxToolCalls: 3 },
      allowedOutputs: ["text/plain"],
    });

  it("membuat delegasi dengan deadline dan budget", () => {
    const task = buat();
    expect(task.id).toMatch(/^a2a_/);
    expect(Date.parse(task.deadline)).toBeGreaterThan(Date.now());
    expect(() => assertDelegationAllowed(task, "tenant_a", "knowledge.search")).not.toThrow();
  });

  it("menolak delegasi lintas tenant", () => {
    expect(() => assertDelegationAllowed(buat(), "tenant_b", "knowledge.search")).toThrow(/tenant ini/);
  });

  it("menolak capability di luar scope", () => {
    expect(() => assertDelegationAllowed(buat(), "tenant_a", "payment.send")).toThrow(/luar scope/);
  });

  it("menolak TTL dan budget tidak valid", () => {
    expect(() =>
      createDelegationTask({
        tenantId: "tenant_a",
        requestingAgent: "a",
        receivingAgent: "b",
        scope: "x",
        ttlMs: 0,
        budget: { maxSteps: 5, maxToolCalls: 1 },
        allowedOutputs: ["text/plain"],
      }),
    ).toThrow(/TTL/);
  });
});
