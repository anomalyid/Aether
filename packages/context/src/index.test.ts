import { describe, expect, it } from "vitest";
import {
  createExecutionContext,
  createSystemContext,
  forkContext,
  getContext,
  requireContext,
  runWithContext,
} from "./index";

describe("propagasi execution context", () => {
  it("membuat context dengan identifier lengkap", () => {
    const context = createExecutionContext({
      actorType: "user",
      tenantId: "tenant_1",
      principalId: "user_1",
    });
    expect(context.requestId).toMatch(/^req_/);
    expect(context.correlationId).toMatch(/^corr_/);
    expect(context.tenantId).toBe("tenant_1");
    expect(context.actorType).toBe("user");
  });

  it("context tersedia di dalam operasi asynchronous", async () => {
    const context = createSystemContext();
    const result = await runWithContext(context, async () => {
      await Promise.resolve();
      return getContext();
    });
    expect(result).toBe(context);
  });

  it("requireContext melempar di luar context", () => {
    expect(() => requireContext()).toThrow(/Execution context tidak tersedia/);
  });

  it("forkContext mempertahankan correlation ID", () => {
    const parent = createSystemContext({ tenantId: "tenant_1" });
    const child = runWithContext(parent, () =>
      forkContext({ principalId: "agent_1", actorType: "agent" }),
    );
    expect(child.correlationId).toBe(parent.correlationId);
    expect(child.requestId).not.toBe(parent.requestId);
    expect(child.tenantId).toBe("tenant_1");
    expect(child.actorType).toBe("agent");
  });
});
