import { describe, expect, it, vi } from "vitest";
import { runCli, type CliClient } from "./index";

function siapkan() {
  const lines: string[] = [];
  const client: CliClient = {
    capabilities: { list: async () => [{ id: "messaging.send", version: "1.0.0" }] },
    agents: {
      list: async () => [{ id: "asisten", version: "1.0.0", name: "Asisten" }],
      getRun: async (id) => ({ id, state: "COMPLETED" }),
    },
    skills: { list: async () => [{ id: "customer-support", name: "Customer Support" }] },
    executions: { list: async () => [{ id: "run_1", state: "COMPLETED" }] },
  };
  return { lines, client, out: (line: string) => lines.push(line) };
}

describe("CLI Aether", () => {
  it("menampilkan bantuan", async () => {
    const ctx = siapkan();
    expect(await runCli(["help"], { out: ctx.out })).toBe(0);
    expect(ctx.lines.join("\n")).toContain("aether doctor");
  });

  it("doctor melaporkan variabel lingkungan yang hilang", async () => {
    const ctx = siapkan();
    const code = await runCli(["doctor"], {
      out: ctx.out,
      env: { AETHER_BASE_URL: "http://localhost:3000" },
    });
    expect(code).toBe(1);
    expect(ctx.lines.join("\n")).toContain("✗ AETHER_TENANT_ID");
  });

  it("doctor lolos ketika semua variabel ada", async () => {
    const ctx = siapkan();
    const code = await runCli(["doctor"], {
      out: ctx.out,
      env: {
        AETHER_BASE_URL: "http://localhost:3000",
        AETHER_TENANT_ID: "tenant_1",
        AETHER_PRINCIPAL_ID: "prin_1",
      },
    });
    expect(code).toBe(0);
  });

  it("menampilkan daftar capability", async () => {
    const ctx = siapkan();
    expect(await runCli(["capabilities", "list"], { client: ctx.client, out: ctx.out })).toBe(0);
    expect(ctx.lines[0]).toContain("messaging.send");
  });

  it("menampilkan daftar agent dan skill", async () => {
    const ctx = siapkan();
    await runCli(["agents", "list"], { client: ctx.client, out: ctx.out });
    await runCli(["skills", "list"], { client: ctx.client, out: ctx.out });
    expect(ctx.lines.some((line) => line.includes("asisten"))).toBe(true);
    expect(ctx.lines.some((line) => line.includes("customer-support"))).toBe(true);
  });

  it("memeriksa execution", async () => {
    const ctx = siapkan();
    expect(
      await runCli(["executions", "inspect", "run_9"], { client: ctx.client, out: ctx.out }),
    ).toBe(0);
    expect(ctx.lines[0]).toContain("run_9");
    expect(ctx.lines[0]).toContain("COMPLETED");
  });

  it("menolak perintah tidak dikenal", async () => {
    const ctx = siapkan();
    expect(await runCli(["mystery"], { client: ctx.client, out: ctx.out })).toBe(1);
  });
});
