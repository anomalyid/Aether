# Riset Teknis Aether

Hasil riset yang dipakai sebagai dasar keputusan arsitektur. Riset diperbarui berkala karena spesifikasi protokol dan ancaman terus berkembang.

| Dokumen | Topik | Status |
| --- | --- | --- |
| [`mcp.md`](mcp.md) | Model Context Protocol 2026-07-28 | Terkunci |
| [`a2a.md`](a2a.md) | Agent2Agent v1.0.0 | Terkunci |
| [`agent-skills.md`](agent-skills.md) | Agent Skills format & progressive disclosure | Terkunci |
| [`whatsapp.md`](whatsapp.md) | WhatsApp Cloud API & Baileys | Terkunci |
| [`owasp-agentic.md`](owasp-agentic.md) | OWASP Top 10 Agentic 2026 | Terkunci |

## Sumber resmi

- MCP Specification — https://modelcontextprotocol.io/specification/2026-07-28
- A2A Protocol — https://a2a-protocol.org/
- Agent Skills — https://agentskills.io/specification
- OWASP GenAI Security — https://genai.owasp.org/
- OpenTelemetry — https://opentelemetry.io/
- PostgreSQL — https://www.postgresql.org/docs/
- Temporal — https://docs.temporal.io/
- Meta WhatsApp — https://developers.facebook.com/docs/whatsapp/
- Baileys — https://baileys.wiki/

## Kebijakan sinkronisasi

Sebelum implementasi MCP client/server, A2A adapter, Skills loader, atau WhatsApp adapter, dokumen ini **wajib** diperiksa kembali terhadap sumber resmi. Jika ada perubahan, buat ADR atau perbarui dokumen spesifikasi terkait.
