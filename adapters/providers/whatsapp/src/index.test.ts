import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  assertBaileysProductionReady,
  normalizeCloudWebhook,
  verifyWebhookChallenge,
  verifyWebhookSignature,
} from "./index";

const payload = {
  object: "whatsapp_business_account",
  entry: [{
    id: "102290129340398",
    changes: [{
      field: "messages",
      value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: "15550783881", phone_number_id: "106540352242922" },
        contacts: [{ profile: { name: "Sheena Nelson" }, wa_id: "16505551234", user_id: "US.123" }],
        messages: [{
          from: "16505551234",
          from_user_id: "US.123",
          id: "wamid.ABC123",
          timestamp: "1749416383",
          type: "text",
          text: { body: "Apakah tersedia warna lain?" },
        }],
      },
    }],
  }],
};

describe("WhatsApp Cloud API webhook", () => {
  it("memverifikasi signature HMAC-SHA256", () => {
    const body = JSON.stringify(payload);
    const signature =
      "sha256=" + createHmac("sha256", "rahasia-app").update(body).digest("hex");
    expect(verifyWebhookSignature(body, signature, "rahasia-app")).toBe(true);
    expect(verifyWebhookSignature(body, signature, "salah")).toBe(false);
    expect(verifyWebhookSignature(body, undefined, "rahasia-app")).toBe(false);
  });

  it("memverifikasi GET challenge", () => {
    const query = { mode: "subscribe", challenge: "1158201444", verifyToken: "token-saya" };
    expect(verifyWebhookChallenge(query, "token-saya")).toBe("1158201444");
    expect(verifyWebhookChallenge(query, "salah")).toBeNull();
    expect(verifyWebhookChallenge({ ...query, mode: "unsubscribe" }, "token-saya")).toBeNull();
  });

  it("menormalkan pesan menjadi canonical domain dengan BSUID", () => {
    const messages = normalizeCloudWebhook(payload, {
      tenantId: "tenant_a",
      integrationId: "integration_1",
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.sender.id).toBe("US.123");
    expect(messages[0]?.content.text).toBe("Apakah tersedia warna lain?");
    expect(messages[0]?.direction).toBe("inbound");
    expect(messages[0]?.provider).toBe("whatsapp.cloud-api");
  });

  it("menghasilkan ID stabil untuk deduplikasi", () => {
    const opsi = { tenantId: "tenant_a", integrationId: "integration_1" };
    const pertama = normalizeCloudWebhook(payload, opsi)[0];
    const kedua = normalizeCloudWebhook(payload, opsi)[0];
    expect(pertama?.id).toBe(kedua?.id);
  });

  it("mengabaikan payload selain whatsapp_business_account", () => {
    expect(normalizeCloudWebhook({ object: "lain" }, {
      tenantId: "tenant_a",
      integrationId: "integration_1",
    })).toEqual([]);
  });
});

describe("Baileys production guard", () => {
  it("menolak auth state file-based untuk produksi", () => {
    expect(() => assertBaileysProductionReady(undefined)).toThrow(/database/);
  });
});
