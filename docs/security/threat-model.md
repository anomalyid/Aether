# Threat Model — Aether

Versi 0.1 · Berbasis OWASP Top 10 for Agentic Applications 2026 dan OWASP AI Agent/MCP Security.

## 1. Aset yang dilindungi

- Identitas & kredensial (user, agent, service, integration).
- Data tenant (pesan, dokumen, memori, knowledge).
- Kontrak & konfigurasi platform (policy, registry, manifest).
- Audit trail dan execution trace.
- Source code dan supply chain package.
- Resource komputasi (token, compute, storage, bandwidth).

## 2. Trust boundary

Setiap aksi — baik dari user, agent, tool, MCP, webhook, maupun plugin — wajib melewati:

```
Identity verification → Permission resolution → Policy evaluation
→ Risk classification → Human approval → Controlled execution
→ Audit and verification
```

## 3. Ancaman & mitigasi

| Ancaman (OWASP) | Mitigasi Aether |
| --- | --- |
| ASI01 Agent Goal Hijack | Isolasi instruksi tepercaya dari data tidak tepercaya; context item memiliki `trust`; konten eksternal bukan instruksi sistem |
| ASI02 Tool Misuse & Exploitation | Capability pipeline; validasi input/output schema; policy engine; approval; runtime budget |
| ASI03 Identity & Privilege Abuse | Principal eksplisit; delegasi ber-expiry & dapat dicabut; deny-by-default; agent tidak meneruskan token user |
| ASI04 Agentic Supply Chain | Lockfile; signature; checksum; provenance; SBOM; vulnerability scanning; pin version |
| ASI05 Unexpected Code Execution | Sandbox terisolasi; tidak ada script eksternal di proses utama; batas CPU/memori/network/output |
| ASI06 Memory & Context Poisoning | Provenance; trust label; validasi sumber; retention & deletion policy |
| ASI07 Insecure Inter-Agent Communication | A2A + TLS 1.2+; identitas di HTTP layer; signed Agent Card; policy Aether tetap berlaku |
| ASI08 Cascading Failures | Timeout; budget; circuit breaker; rate limit; kill switch; graceful degradation |
| ASI09 Human-Agent Trust Exploitation | Approval terikat pada parameter; tampilkan identitas agent, aksi, resource, dampak; approval kedaluwarsa jelas |
| ASI10 Rogue Agents | Agent identity; run limit; revocation; monitoring; anomali → kill switch |

Tambahan spesifik:

| Ancaman | Kontrol |
| --- | --- |
| MCP token misuse | RFC 8707 audience validation; RFC 9207 issuer validation; token tidak diteruskan; tidak di query string |
| Tool poisoning | Verifikasi metadata & versi; snapshot tool schema; deskripsi untrusted |
| Credential theft | Secret vault; scoped credentials; redaction; rotation; revocation |
| Cross-tenant leakage | Tenant context tervalidasi; repository tenant-aware; RLS; automated cross-tenant test |
| Replay attack | Nonce; timestamp; idempotency key; dedup |
| Prompt injection via webhook | HMAC verification; normalisasi; label untrusted |

## 4. Prinsip least agency

Berikan agent hanya otonomi dan akses yang benar-benar dibutuhkan, hanya selama dibutuhkan. `agent.run` tidak berarti agent boleh mengirim pesan, menghapus data, atau mengakses integrasi lain.

## 5. Klasifikasi risiko aksi

| Risiko | Contoh | Kontrol |
| --- | --- | --- |
| Rendah | Baca data diizinkan | Otomatis + audit |
| Menengah | Draft, perubahan reversible | Policy check |
| Tinggi | Kirim pesan eksternal, ubah data penting | Consent + approval |
| Kritis | Finansial, perubahan akses, hapus massal | Approval eksplisit + review |

## 6. Status pengujian

- ✅ Threat model awal: tersedia (dokumen ini).
- ✅ Security test kernel: kontrak, redaksi secret, cleanup aman.
- ⬜ Prompt injection test: belum (butuh Agent Runtime).
- ⬜ Cross-tenant test: belum (butuh domain Identity + Data).
- ⬜ Security audit formal: belum.

**MUST NOT** mengklaim sistem aman hanya karena threat model ditulis.
