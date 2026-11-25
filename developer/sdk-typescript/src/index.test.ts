import { describe, expect, it, vi } from "vitest";
import { AetherApiError, AetherClient, type AetherClientOptions } from "./index";

function siapkan(handler: (url: string, init: RequestInit) => Promise<Response>) {
  const fetchImpl = vi.fn(handler) as unknown as typeof fetch;
  const options: AetherClientOptions = {
    baseUrl: "http://localhost:3000/",
    tenantId: "tenant_1",
    principalId: "prin_1",
    fetch: fetchImpl,
  };
  return { client: new AetherClient(options), fetchImpl };
}

const sukses = (data: unknown) =>
  new Response(JSON.stringify({ data, error: null, meta: { request_id: "req_1" } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("SDK Aether", () => {
  it("mengirim tenant context dan principal pada setiap request", async () => {
    const { client, fetchImpl } = siapkan(async () => sukses([]));
    await client.capabilities.list();

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3000/v1/capabilities");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-aether-tenant-id"]).toBe("tenant_1");
    expect(headers["x-aether-principal-id"]).toBe("prin_1");
  });

  it("memanggil capability dengan input", async () => {
    const { client } = siapkan(async (_url, init) => {
      const body = JSON.parse(String(init.body)) as { input: Record<string, unknown> };
      expect(body.input.destination).toBe("62812");
      return sukses({ status: "completed" });
    });
    const result = await client.capabilities.invoke("messaging.send", { destination: "62812" });
    expect(result.status).toBe("completed");
  });

  it("menjalankan agent dan menyetujui run", async () => {
    const { client } = siapkan(async (url) => {
      if (url.includes("/approve")) return sukses({ id: "run_1", state: "COMPLETED" });
      return sukses({ id: "run_1", state: "WAITING_APPROVAL", approvalId: "appr_1" });
    });

    const run = await client.agents.run("asisten", { pesan: "Halo" });
    expect(run.state).toBe("WAITING_APPROVAL");
    const approved = await client.agents.approve(run.id, "appr_1");
    expect(approved.state).toBe("COMPLETED");
  });

  it("memetakan error API menjadi AetherApiError", async () => {
    const { client } = siapkan(async () =>
      new Response(
        JSON.stringify({
          data: null,
          error: { code: "AUTHORIZATION_DENIED", message: "Ditolak", details: {} },
          meta: { request_id: "req_err" },
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(client.capabilities.list()).rejects.toBeInstanceOf(AetherApiError);
    await expect(client.capabilities.list()).rejects.toMatchObject({
      code: "AUTHORIZATION_DENIED",
      status: 403,
      requestId: "req_err",
    });
  });

  it("mengencode identifier pada path", async () => {
    const { client, fetchImpl } = siapkan(async () => sukses({ instructions: "isi" }));
    await client.skills.get("skill/ dengan spasi");
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toContain("skill%2F%20dengan%20spasi");
  });
});
