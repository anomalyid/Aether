# Riset — Model Context Protocol (MCP) 2026-07-28

## Ringkasan eksekutif

MCP 2026-07-28 adalah perubahan besar dari protokol stateful menjadi **stateless request/response**. Ini berdampak langsung pada desain MCP Gateway Aether.

## Perubahan kunci

1. **Stateless core.** Handshake `initialize` / `notifications/initialized` dan header `Mcp-Session-Id` dihapus. Setiap request membawa versi, identitas, dan capability sendiri di `_meta`.
2. **`server/discover` wajib.** Server MUST mengimplementasikan RPC ini untuk mengiklankan versi, capability, dan identitas. Client MAY memanggilnya lebih dulu; tidak wajib.
3. **Negosiasi versi per-request.** Request membawa `_meta["io.modelcontextprotocol/protocolVersion"]`. Jika tidak didukung → `UnsupportedProtocolVersionError` (kode `-32022`) dengan daftar versi yang didukung. HTTP juga membawa header `MCP-Protocol-Version`.
4. **Identity per-request.** Client SHOULD mengirim `io.modelcontextprotocol/clientInfo`; server SHOULD mengembalikan `io.modelcontextprotocol/serverInfo`.
5. **Extensions framework.** Ekstensi opt-in, dinegosiasi lewat `capabilities.extensions`. Contoh: `io.modelcontextprotocol/tasks` (async task dengan polling `tasks/get`, input `tasks/update`, handle eksplisit), Skills over MCP, MCP Apps (`io.modelcontextprotocol/ui`).
6. **Task extension** keluar dari core. `tasks/result` blocking diganti polling; `tasks/list` dihapus.
7. **Authorization hardening.**
   - OAuth 2.1; RFC 9728 Protected Resource Metadata (server WAJIB, client WAJIB pakai untuk discovery).
   - RFC 8707 `resource` parameter WAJIB di authorization & token request, mengidentifikasi MCP server sebagai audience.
   - RFC 9207 `iss` validation: server SHOULD mengirim `iss`; client MUST memvalidasi `iss` yang ada terhadap issuer tersimpan sebelum menebus kode. Jika metadata mengiklankan dukungan `iss` tapi `iss` absen → tolak.
   - Client ID Metadata Documents (CIMD) menggantikan Dynamic Client Registration (DCR). DCR deprecated, masih untuk backward compatibility.
   - Kredensial client terikat pada issuer; tidak reusable lintas authorization server.
   - Bearer token di header `Authorization`, di setiap request HTTP. **MUST NOT** di query string.
   - Server MUST memvalidasi token diterbitkan untuk dirinya (audience). Token invalid/expired → 401.
8. **Scope strategy.** Server SHOULD mengirim `scope` di header `WWW-Authenticate` sesuai RFC 6750. Client memakai scope challenge sebagai otoritatif untuk operasi berjalan; `scopes_supported` adalah set minimal untuk fungsi dasar, dengan step-up authorization.

## Implikasi untuk Aether

- Versi protokol dan SDK **dipatok**, diuji kompatibilitasnya. Tidak mengasumsikan semua server mendukung fitur yang sama.
- MCP **bukan** arsitektur internal Aether. Internal capability contract tetap kanonis (ADR-003).
- Aether MCP Server: ekspos capability sebagai tools, resources diizinkan, prompts bila perlu, jalankan authorization Aether + policy, validasi request/response.
- Aether MCP Client: terhubung ke server eksternal, snapshot tool schema, panggil via policy engine, pantau perubahan schema, tangani lifecycle & cancellation.
- Deskripsi tool dan hasil tool diperlakukan **untrusted** (bisa jadi vektor prompt injection / tool poisoning).
- Token access yang masuk **MUST NOT** diteruskan ke server lain.
- Batasi timeout dan ukuran output.
- Simpan entitas: `mcp_servers`, `mcp_server_versions`, `mcp_connections`, `mcp_credentials`, `mcp_tool_snapshots`, `mcp_resource_snapshots`, `mcp_invocations`, `mcp_health_checks`.

## Status

Riset selesai 2026-11-25. Sebelum implementasi adapter, cek ulang https://modelcontextprotocol.io/specification/2026-07-28 dan schema.ts resmi.
