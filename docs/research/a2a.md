# Riset — Agent2Agent (A2A) Protocol v1.0.0

## Ringkasan eksekutif

A2A v1.0.0 dirilis 2026-03-12 sebagai versi stabil production-ready. A2A adalah protokol komunikasi & delegasi antar-agent, **bukan** pengganti identity, policy, atau capability system Aether.

## Fakta penting

- Spesifikasi normative: file `spec/a2a.proto` adalah satu-satunya definisi authoritative untuk objek data dan message. JSON artifact non-normative. SDK **MUST** di-generate dari proto, bukan diedit manual.
- Versi terbaru `1.0.0`; sebelumnya `0.3.0`, `0.2.6`, `0.1.0`.
- SDK resmi: Python, Go, Java, JavaScript, C#/.NET, Rust.

## Agent Card

Self-describing manifest untuk discovery. Field wajib: `name`, `description`, `supportedInterfaces`, `version`, `capabilities`, `defaultInputModes`, `defaultOutputModes`, `skills`. Opsional: `provider`, `documentationUrl`, `securitySchemes`, `securityRequirements`, `signatures`, `iconUrl`.

`AgentInterface`: `url` (HTTPS absolut di produksi), `protocolBinding` (`JSONRPC`, `GRPC`, `HTTP+JSON`), `protocolVersion`, opsional `tenant` untuk routing.

Extended Agent Card hanya tersedia jika `capabilities.extendedAgentCard: true` dan client terautentikasi. Client SHOULD mengganti cached public card dengan extended card selama sesi terautentikasi.

Signed Agent Card (JWS RFC 7515) memberi verifikasi kriptografis atas identity & metadata agent — penting untuk kepercayaan lintas organisasi.

## Security

- TLS 1.2+ wajib di produksi; verifikasi sertifikat terhadap CA tepercaya.
- Identitas **tidak** dibawa di payload JSON-RPC; ditetapkan di layer HTTP.
- Skema: `apiKeySecurityScheme`, `httpAuthSecurityScheme`, `oauth2SecurityScheme`, `openIdConnectSecurityScheme`, `mtlsSecurityScheme` — tepat satu.
- Kredensial diperoleh out-of-band (OAuth flow / secure key distribution), dikirim via header standar (`Authorization: Bearer`, `API-Key`).
- Server wajib memvalidasi setiap request; 401 untuk kredensial invalid (dengan `WWW-Authenticate`), 403 untuk tidak berizin.
- Secondary credentials untuk akses sistem lain during task diperoleh client secara out-of-band.
- Authorization: granular, berbasis authenticated identity, per-skill, dan data/action-level. Least privilege.
- v1.0: `ImplicitOAuthFlow` dan `PasswordOAuthFlow` dihapus; `DeviceCodeOAuthFlow` (RFC 8628) ditambahkan; `pkce_required` ditambahkan pada authorization code flow.

## Implikasi untuk Aether

- Aether dapat berperan: agent host, agent client, discovery gateway, delegation controller.
- Setiap delegated task wajib memiliki: requesting agent, receiving agent, tenant, task ID, scope, deadline, budget, allowed outputs, delegation record.
- Agent eksternal **MUST NOT** otomatis mendapat akses ke capability internal Aether.
- Komunikasi antar-agent tunduk pada policy Aether; A2A tidak menggantikan trust boundary.
- Simpan entitas `a2a_agents` dan delegation records.

## Status

Riset selesai 2026-11-25. Cek ulang https://a2a-protocol.org/latest/specification/ sebelum implementasi adapter.
