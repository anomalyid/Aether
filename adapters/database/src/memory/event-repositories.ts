/**
 * Implementasi in-memory untuk ProcessedEventStore dan OutboxStore.
 *
 * By Anomalyid.
 */

import type {
  EventEnvelope,
  OutboxRecord,
  OutboxStore,
  ProcessedEventStore,
} from "@aether/events";
import { createId } from "@aether/identifiers";

export class MemoryProcessedEventStore implements ProcessedEventStore {
  private readonly processed = new Set<string>();

  async markProcessed(eventId: string, consumerId: string): Promise<boolean> {
    const key = `${consumerId}:${eventId}`;
    if (this.processed.has(key)) return false;
    this.processed.add(key);
    return true;
  }
}

export class MemoryOutboxStore implements OutboxStore {
  private readonly records: OutboxRecord[] = [];

  async add(event: EventEnvelope): Promise<void> {
    const record: OutboxRecord = {
      id: createId("outbox"),
      event,
      ...(event.tenantId === undefined ? {} : { tenantId: event.tenantId }),
      createdAt: new Date().toISOString(),
    };
    this.records.push(record);
  }

  async pending(limit: number): Promise<OutboxRecord[]> {
    return this.records
      .filter((record) => record.publishedAt === undefined)
      .slice(0, limit)
      .map((record) => ({ ...record }));
  }

  async markPublished(id: string): Promise<void> {
    const record = this.records.find((item) => item.id === id);
    if (record !== undefined) record.publishedAt = new Date().toISOString();
  }
}
