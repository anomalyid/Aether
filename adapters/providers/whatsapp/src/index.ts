/**
 * Integrasi WhatsApp Aether.
 *
 * WhatsApp hanyalah salah satu adapter, bukan identitas platform.
 * Jalur resmi (Cloud API) diprioritaskan; Baileys bersifat eksperimental.
 *
 * By Anomalyid.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { AetherError, ErrorCode } from "@aether/errors";

export interface MessageParty {
  id: string;
  name?: string;
}

export interface MessageContent {
  type: "text" | "image" | "document" | "interactive" | "unknown";
  text?: string;
  mediaId?: string;
  caption?: string;
}

export interface UnifiedMessage {
  id: string;
  tenantId: string;
  integrationId: string;
  provider: string;
  externalMessageId?: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  sender: MessageParty;
  recipient: MessageParty;
  content: MessageContent;
  status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  occurredAt: string;
  createdAt: string;
}

export interface SendMessageRequest {
  destination: string;
  content: MessageContent;
  replyTo?: string;
}

export interface SendMessageResult {
  externalMessageId: string;
  status: "queued" | "sent";
}

export interface ProviderConfig {
  tenantId: string;
  integrationId: string;
  credentialsRef: string;
}

export interface MessagingProvider {
  readonly name: string;
  connect(config: ProviderConfig): Promise<void>;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResult>;
  getMessage(externalId: string): Promise<UnifiedMessage | null>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<{ status: "healthy" | "degraded" | "unhealthy"; checkedAt: string }>;
}

/** Verifikasi HMAC-SHA256 webhook Meta (X-Hub-Signature-256). */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (signatureHeader === undefined || !signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
}

/** Verifikasi GET challenge. Mengembalikan challenge bila valid, null bila tidak. */
export function verifyWebhookChallenge(
  query: { mode?: string; challenge?: string; verifyToken?: string },
  expectedToken: string,
): string | null {
  if (query.mode !== "subscribe") return null;
  if (expectedToken.length === 0 || query.verifyToken !== expectedToken) return null;
  return query.challenge ?? null;
}

interface CloudMessage {
  id?: string;
  from?: string;
  from_user_id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string };
  document?: { id?: string; caption?: string };
}

interface CloudPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        messages?: CloudMessage[];
        contacts?: Array<{ wa_id?: string; user_id?: string; profile?: { name?: string } }>;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
      };
    }>;
  }>;
}

/** Normalisasi payload webhook Cloud API menjadi UnifiedMessage kanonik. */
export function normalizeCloudWebhook(
  payload: CloudPayload,
  options: { tenantId: string; integrationId: string },
): UnifiedMessage[] {
  if (payload.object !== "whatsapp_business_account") return [];

  const results: UnifiedMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      if (value === undefined) continue;

      const contact = value.contacts?.[0];
      const phoneId = value.metadata?.phone_number_id ?? "unknown";

      for (const message of value.messages ?? []) {
        const externalId = message.id;
        if (externalId === undefined) continue;

        // BSUID lebih stabil daripada nomor telepon bila user memakai username.
        const senderId = message.from_user_id ?? message.from ?? contact?.user_id ?? contact?.wa_id;
        if (senderId === undefined) continue;

        const content: MessageContent = messageContent(message);
        const occurredAt = message.timestamp === undefined
          ? new Date().toISOString()
          : new Date(Number(message.timestamp) * 1000).toISOString();

        results.push({
          id: `msg_${createHash("sha256").update(externalId).digest("hex").slice(0, 24)}`,
          tenantId: options.tenantId,
          integrationId: options.integrationId,
          provider: "whatsapp.cloud-api",
          externalMessageId: externalId,
          conversationId: senderId,
          direction: "inbound",
          sender: {
            id: senderId,
            ...(contact?.profile?.name === undefined ? {} : { name: contact.profile.name }),
          },
          recipient: { id: phoneId },
          content,
          status: "received",
          occurredAt,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
  return results;
}

function messageContent(message: CloudMessage): MessageContent {
  const type = message?.type;
  if (type === "text") return { type: "text", text: message.text?.body ?? "" };
  if (type === "image") {
    return { type: "image", mediaId: message.image?.id, caption: message.image?.caption };
  }
  if (type === "document") {
    return { type: "document", mediaId: message.document?.id, caption: message.document?.caption };
  }
  return { type: "unknown" };
}

/**
 * Port auth state untuk adapter Baileys.
 *
 * useMultiFileAuthState TIDAK direkomendasikan untuk produksi.
 * Implementasi produksi wajib menyimpan creds dan Signal keys ke database
 * dengan persistensi sebelum `keys.set()` resolve.
 */
export interface BaileysAuthStateStore {
  load(accountId: string): Promise<{ creds: unknown; keys: unknown } | null>;
  save(accountId: string, state: { creds: unknown; keys: unknown }): Promise<void>;
}

export function assertBaileysProductionReady(store: BaileysAuthStateStore | undefined): void {
  if (store === undefined) {
    throw new AetherError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      "Produksi memerlukan auth state store berbasis database, bukan useMultiFileAuthState.",
      { category: "infrastructure", retryable: false },
    );
  }
}
