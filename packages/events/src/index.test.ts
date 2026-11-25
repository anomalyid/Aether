import { describe, expect, it, vi } from "vitest";
import {
  InMemoryEventBus,
  IdempotentConsumer,
  OutboxPublisher,
  assertEventEnvelope,
  createEvent,
} from "./index";
import { MemoryOutboxStore, MemoryProcessedEventStore } from "@aether/database";

const buatEvent = (id: string, data: Record<string, unknown> = {}) =>
  createEvent({
    id,
    type: "message.received",
    tenantId: "tenant_a",
    correlationId: "corr_1",
    source: "integration.whatsapp",
    data,
  });

describe("Event envelope", () => {
  it("membuat envelope dengan versi dan identifier", () => {
    const event = buatEvent("evt_1", { pesan: "halo" });
    expect(event.id).toBe("evt_1");
    expect(event.version).toBe(1);
    expect(event.tenantId).toBe("tenant_a");
    expect(() => assertEventEnvelope(event)).not.toThrow();
  });

  it("menolak envelope tidak valid", () => {
    const event = buatEvent("evt_2");
    expect(() => assertEventEnvelope({ ...event, version: 0 })).toThrow(/tidak valid/);
  });

  it("menghapus secret dari payload event", () => {
    const serialized = JSON.stringify(
      buatEvent("evt_3", { apiToken: "sk-abcdefghijklmnopqrstuvwxyz123456", aman: true }),
    );
    expect(serialized).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(serialized).toContain("[REDACTED]");
  });
});

describe("Event bus", () => {
  it("mengirim event ke subscriber tipe dan wildcard", async () => {
    const bus = new InMemoryEventBus();
    const diterima: string[] = [];
    bus.subscribe("message.received", async () => { diterima.push("spesifik"); });
    bus.subscribe("*", async () => { diterima.push("wildcard"); });
    await bus.publish(buatEvent("evt_4"));
    expect(diterima).toEqual(["spesifik", "wildcard"]);
  });
});

describe("Consumer idempotent", () => {
  it("memproses event duplikat hanya sekali", async () => {
    const handler = vi.fn(async () => {});
    const consumer = new IdempotentConsumer(
      new MemoryProcessedEventStore(),
      "consumer-1",
      handler,
    );
    const event = buatEvent("evt_duplikat");
    expect(await consumer.handle(event)).toBe(true);
    expect(await consumer.handle({ ...event })).toBe(false);
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe("Transactional outbox", () => {
  it("mengirim event pending dan menandainya published", async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn(async () => {});
    bus.subscribe("message.received", handler);

    const store = new MemoryOutboxStore();
    await store.add(buatEvent("evt_outbox_1"));
    const publisher = new OutboxPublisher(store, bus);

    expect(await publisher.drain()).toBe(1);
    expect(handler).toHaveBeenCalledOnce();
    expect(await publisher.drain()).toBe(0);
  });

  it("membiarkan event pending ketika publisher gagal", async () => {
    const store = new MemoryOutboxStore();
    await store.add(buatEvent("evt_outbox_2"));
    const publisher = new OutboxPublisher(store, {
      publish: async () => { throw new Error("broker mati"); },
    });

    expect(await publisher.drain()).toBe(0);
    expect(await store.pending(10)).toHaveLength(1);
  });
});
