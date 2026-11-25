# Dokumen 06 — Protocols, Integrations & Workflow Specification

## 6.1 Protocol architecture

| Teknologi | Tanggung jawab |
| --- | --- |
| REST API | Public management API |
| WebSocket | Realtime bila diperlukan |
| MCP | Interoperabilitas model & tools |
| A2A | Komunikasi antar-agent |
| Webhooks | Event masuk dari provider |
| Internal contracts | Komunikasi antar-modul |
| Message broker | Async event delivery |
| OAuth/OIDC | Authentication & delegated authorization |

MCP dan A2A **MUST NOT** menggantikan internal domain architecture. Internal API Aether tetap sumber kontrak kanonis.

## 6.2 MCP Gateway

Dua peran:

**MCP Server** — mengekspos capability Aether sebagai tools; resources yang diizinkan; prompts bila perlu; menjalankan authorization; memvalidasi request & response.

**MCP Client** — terhubung ke server eksternal; menemukan tools; mengambil metadata; memanggil tools melalui policy engine; connection lifecycle; memantau perubahan schema.

```
External MCP Client → AETHER MCP SERVER → Capability Gateway
→ Policy Engine → Internal Capability

AETHER MCP CLIENT → External MCP Server → External Tool
```

### Spesifikasi MCP 2026-07-28 (terkunci dari riset)

- Core **stateless**: handshake `initialize`/`notifications/initialized` dan header `Mcp-Session-Id` dihapus.
- Setiap request membawa protocol version, client identity, dan capabilities di `_meta` (`io.modelcontextprotocol/protocolVersion`, `io.modelcontextprotocol/clientCapabilities`, `io.modelcontextprotocol/clientInfo`).
- Server **MUST** mengimplementasikan `server/discover`; client MAY memanggilnya lebih dulu.
- Versi tidak didukung → `UnsupportedProtocolVersionError` (kode `-32022`) dengan daftar versi didukung.
- Ekstensi opt-in dan dinegosiasi lewat `capabilities.extensions`: Tasks (`io.modelcontextprotocol/tasks`), Skills over MCP, MCP Apps.
- Authorization: OAuth 2.1, RFC 9728 Protected Resource Metadata, RFC 8707 `resource` parameter wajib, RFC 9207 `iss` validation wajib pada client, DCR deprecated demi Client ID Metadata Documents (CIMD), token harus tervalidasi audience-nya.
- Token **MUST NOT** berada di query string; authorization header di setiap request HTTP.
- Deskripsi tool dan hasil tool diperlakukan sebagai **untrusted**.

Kebijakan Aether: pin protocol version; validate tool schemas; enforce authentication; **never blindly forward incoming access tokens**; timeout & output-size limit; track schema changes; approval bila policy menuntut; cancellation & recovery didukung.

## 6.3 MCP server registry

Entitas: `mcp_servers`, `mcp_server_versions`, `mcp_connections`, `mcp_credentials`, `mcp_tool_snapshots`, `mcp_resource_snapshots`, `mcp_invocations`, `mcp_health_checks`.

Setiap koneksi memiliki server identity, transport type, endpoint/command config, auth method, credential reference, allowed tools, allowed resources, timeout, health status, last successful connection. Koneksi berhasil **MUST NOT** otomatis memberi akses ke semua tool.

## 6.4 A2A interoperability

A2A v1.0.0 (stabil, 2026-03-12) dipakai untuk komunikasi & delegasi antar-agent. Aether dapat berperan sebagai agent host, client, discovery gateway, delegation controller. A2A **MUST NOT** menggantikan identity & policy Aether.

Agent Card (self-describing manifest): `name`, `description`, `supportedInterfaces`, `provider`, `version`, `capabilities`, `securitySchemes`, `securityRequirements`, `defaultInputModes`, `defaultOutputModes`, `skills`, `signatures`, `iconUrl`. Extended Agent Card hanya setelah autentikasi (`capabilities.extendedAgentCard: true`).

Security: TLS 1.2+ wajib di produksi; identitas di layer HTTP, bukan payload; kredensial diperoleh out-of-band; server memvalidasi tiap request; 401 untuk kredensial invalid, 403 untuk tidak berizin; authorization per-skill; PKCE wajib untuk public client; `DeviceCodeOAuthFlow` untuk CLI/IoT; implicit & password flow dihapus. Signed Agent Card memberi verifikasi kriptografis.

Setiap delegated task memiliki requesting agent, receiving agent, tenant, task ID, scope, deadline, budget, allowed outputs, delegation record. Agent eksternal **MUST NOT** otomatis mendapat akses ke capability internal.

## 6.5 Integration architecture

Setiap provider berada di balik adapter.

```ts
interface MessagingProvider {
  connect(config: ProviderConfig): Promise<ConnectionResult>;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResult>;
  getMessage(id: string): Promise<MessageResult>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<HealthResult>;
}
```

Provider-specific types **MUST NOT** bocor ke domain messaging.

## 6.6 WhatsApp integration

WhatsApp adalah salah satu demonstrasi kemampuan platform, **bukan identitas seluruh Aether**.

**Jalur resmi — WhatsApp Business Platform Cloud API:** diprioritaskan untuk penggunaan bisnis/komersial. WABA diperlukan. Webhook: verifikasi GET via `hub.verify_token` → respons `hub.challenge`; POST dengan `X-Hub-Signature-256` HMAC-SHA256 memakai app secret; payload hingga 3 MB; retry hingga 7 hari → dedup wajib; mTLS didukung. Permission: `whatsapp_business_messaging`, `whatsapp_business_management`.

**Jalur tidak resmi — Baileys (`@whiskeysockets/baileys`):** eksperimental, tidak afiliasi dengan WhatsApp, memakai WhatsApp Web Linked Devices. `useMultiFileAuthState` **tidak direkomendasikan produksi** — store auth state berbasis database wajib untuk produksi. `creds.update` dan `keys.set()` harus persist sebelum resolve. v7 membawa breaking changes (LID, auth-state). Jangan jadikan satu-satunya fondasi produk komersial.

Pemisahan wajib:

```
messaging.domain → whatsapp.provider.interface
    ├── official_cloud_adapter
    └── experimental_baileys_adapter
```

Session storage, credential encryption, connection ownership, lifecycle, recovery menjadi tanggung jawab Integration Domain, bukan Agent Runtime. Untuk semua messaging integration: hormati consent penerima, kebijakan provider, pembatasan pesan, dan opt-out.

## 6.7 Canonical messaging domain

```ts
interface UnifiedMessage {
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
```

## 6.8 Event architecture

Contoh event: `agent.run.created`, `agent.run.completed`, `capability.invoked`, `skill.installed`, `integration.connected`, `message.received`, `workflow.started`, `approval.requested`.

```json
{
  "id": "evt_example",
  "type": "message.received",
  "version": 1,
  "tenant_id": "tenant_example",
  "occurred_at": "2026-11-26T10:00:00Z",
  "correlation_id": "corr_example",
  "source": "integration.whatsapp",
  "data": {}
}
```

Wajib: unique ID, type, schema version, timestamp, source, tenant context, correlation ID, payload.

## 6.9 Transactional outbox

```
DB TRANSACTION → simpan business data + outbox event → COMMIT
→ OUTBOX PUBLISHER → MESSAGE BROKER → CONSUMER
```

Consumer wajib idempotent & dedup.

## 6.10 Workflow engine

Mendukung sequential, conditional branch, parallel, retry, timeout, cancellation, human approval, compensation, checkpoint, recovery, execution history. Simpan workflow definition version, execution state, completed/pending steps, retry info, approval state, external operation references, checkpoint, error history.

Teknologi awal: database-backed execution + queue. Evaluasi Temporal bila kebutuhan durable orchestration berkembang. **MUST NOT** memasang banyak workflow engine sekaligus.

## 6.11 Retry classification

| Error | Kebijakan |
| --- | --- |
| Invalid input | Tidak retry |
| Authorization denied | Tidak retry |
| Provider rate limit | Retry sesuai guidance |
| Temporary network failure | Retry terbatas |
| Provider unavailable | Backoff + circuit breaker |
| Unknown external outcome | Reconcile dahulu |
| User cancellation | Tidak retry |
| Approval expired | Minta keputusan baru |

## 6.12 Acceptance criteria

- [ ] MCP server diekspos dengan authorization
- [ ] MCP client menemukan & memanggil tools
- [ ] Token tidak diteruskan sembarangan
- [ ] Provider adapter memiliki kontrak bersama
- [ ] Event schema memiliki versi
- [ ] Outbox mencegah kehilangan event
- [ ] Consumer dedup
- [ ] Workflow dilanjutkan setelah restart
- [ ] Approval & cancellation bekerja
- [ ] Unknown external outcome direkonsiliasi
