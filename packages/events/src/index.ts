/**
 * Event envelope, bus, consumer idempotent, dan transactional outbox.
 *
 * By Anomalyid.
 */

import { createId } from "@aether/identifiers";
import { AetherError, ErrorCode, redactSecrets } from "@aether/errors";

export interface EventEnvelope {
  id: string;
  type: string;
  version: number;
  tenantId?: string;
  occurredAt: string;
  correlationId?: string;
  source: string;
  data: Record<string, unknown>;
}

export interface CreateEventInput {
  type: string;
  version?: number;
  tenantId?: string;
  correlationId?: string;
  source: string;
  data: Record<string, unknown>;
  id?: string;
}

export function createEvent(input: CreateEventInput): EventEnvelope {
  if (input.type.trim().length === 0 || input.source.trim().length === 0) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Event wajib memiliki type dan source.", {
      category: "validation",
      retryable: false,
    });
  }
  const occurredAt = new Date().toISOString();
  const event: EventEnvelope = {
    id: input.id ?? createId("evt"),
    type: input.type,
    version: input.version ?? 1,
    occurredAt,
    source: input.source,
    data: redactSecrets(input.data) as Record<string, unknown>,
  };
  if (input.tenantId !== undefined) event.tenantId = input.tenantId;
  if (input.correlationId !== undefined) event.correlationId = input.correlationId;
  return event;
}

export function assertEventEnvelope(event: EventEnvelope): void {
  if (
    event.id.trim().length === 0 ||
    event.type.trim().length === 0 ||
    !Number.isInteger(event.version) ||
    event.version < 1 ||
    Number.isNaN(Date.parse(event.occurredAt)) ||
    event.source.trim().length === 0
  ) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Event envelope tidak valid.", {
      category: "validation",
      retryable: false,
    });
  }
}

export type EventHandler = (event: EventEnvelope) => Promise<void>;

export interface EventPublisher {
  publish(event: EventEnvelope): Promise<void>;
}

export class InMemoryEventBus implements EventPublisher {
  private readonly handlers = new Map<string, EventHandler[]>();

  subscribe(type: string, handler: EventHandler): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
    return () => {
      const current = this.handlers.get(type) ?? [];
      this.handlers.set(type, current.filter((item) => item !== handler));
    };
  }

  async publish(event: EventEnvelope): Promise<void> {
    assertEventEnvelope(event);
    const targets = [...(this.handlers.get(event.type) ?? []), ...(this.handlers.get("*") ?? [])];
    for (const handler of targets) await handler(event);
  }
}

export interface ProcessedEventStore {
  /** Mengembalikan true hanya untuk pertama kali event diproses consumer ini. */
  markProcessed(eventId: string, consumerId: string): Promise<boolean>;
}

export class IdempotentConsumer {
  constructor(
    private readonly store: ProcessedEventStore,
    private readonly consumerId: string,
    private readonly handler: EventHandler,
  ) {}

  async handle(event: EventEnvelope): Promise<boolean> {
    const first = await this.store.markProcessed(event.id, this.consumerId);
    if (!first) return false;
    await this.handler(event);
    return true;
  }
}

export interface OutboxRecord {
  id: string;
  event: EventEnvelope;
  tenantId?: string;
  createdAt: string;
  publishedAt?: string;
}

export interface OutboxStore {
  add(event: EventEnvelope): Promise<void>;
  pending(limit: number): Promise<OutboxRecord[]>;
  markPublished(id: string): Promise<void>;
}

export class OutboxPublisher {
  constructor(
    private readonly store: OutboxStore,
    private readonly publisher: EventPublisher,
  ) {}

  async drain(limit = 100): Promise<number> {
    const pending = await this.store.pending(limit);
    let count = 0;
    for (const record of pending) {
      try {
        await this.publisher.publish(record.event);
        await this.store.markPublished(record.id);
        count += 1;
      } catch {
        // Event tetap Pending dan akan dicoba ulang pada drain berikutnya.
      }
    }
    return count;
  }
}
