# SECURITY.md — Kebijakan Keamanan Aether

## Prinsip

- **Default deny.** Izin tidak diberikan secara implicit.
- **Least agency.** Agent diberi otonomi dan akses hanya seperlunya, hanya selama diperlukan.
- **Setiap aksi melewati trust boundary:** identitas → izin → policy → risiko → approval → eksekusi terkontrol → audit.
- **Agent bukan pemilik izin tanpa batas.** Agent adalah principal dengan identitas, scope, batas, dan delegasi eksplisit.

## Model ancaman

Aether secara aktif menguji risiko berikut (OWASP Top 10 for Agentic Applications 2026):

| Ancaman | Kontrol utama |
| --- | --- |
| Agent Goal Hijack | Isolasi instruksi tepercaya dan data tidak tepercaya |
| Tool Misuse | Policy engine + validasi parameter |
| Identity & Privilege Abuse | Principal eksplisit, delegasi ber-expiry, deny by default |
| Supply Chain | Lockfile, signature, provenance, vulnerability scanning |
| Unexpected Code Execution | Sandbox terisolasi, bukan proses utama |
| Memory Poisoning | Provenance, trust label, validasi sumber |
| Insecure Inter-Agent Communication | A2A + identitas + policy Aether tetap berlaku |
| Cascading Failures | Budget, circuit breaker, timeout, kill switch |
| Rogue Agents | Agent identity, run limit, revocation, monitoring |
| Tool/Token Misuse (MCP) | Audience validation, token separation, `iss` validation |

Detail lengkap: [`docs/security/threat-model.md`](docs/security/threat-model.md).

## Aturan pengamanan kode

- Credential wajib tersimpan di secret vault, **bukan** plaintext.
- Secret tidak boleh masuk: prompt agent, tool description, log, error message, analytics, source code, atau skill package publik.
- Token OAuth harus divalidasi audience-nya (RFC 8707) dan issuer-nya (RFC 9207).
- Access token MCP **tidak boleh** diteruskan ke server lain.
- Webhook wajib diverifikasi (`X-Hub-Signature-256` untuk WhatsApp) dan bersifat idempoten.
- Setiap resource tenant wajib memiliki `tenant_id` dan diperiksaownership-nya.

## Melaporkan kerentanan

**Jangan** buat issue publik.

Kirim laporan ke: **ibradecode@gmail.com**

Sertakan:
- deskripsi kerentanan dan dampaknya;
- langkah reproduksi;
- komponen yang terdampak;
- versi commit / release;
- saran perbaikan (jika ada).

Kami akan mengonfirmasi penerimaan, menyelidiki, dan memberikan update. Jangan mengeksploitasi kerentanan di luar lingkungan pengujian yang Anda miliki.

## Status audit

- ❌ Security audit formal: **belum dilakukan**.
- ❌ Benchmark produksi: **belum dilakukan**.
- ✅ Threat model awal: tersedia.
- ✅ Security test dasar pada kernel: tersedia.
