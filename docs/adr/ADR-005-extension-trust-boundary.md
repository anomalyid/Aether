# ADR-005 — Extension Trust Boundary

- **Status:** Accepted
- **Tanggal:** 2026-11-25

## Context

Skills, plugins, scripts eksternal, dan MCP tool dapat berisi kode atau instruksi yang tidak dipercaya.

## Decision

Semua ekstensi eksternal **untrusted by default**. Eksekusi wajib melewati validasi, permission check, dan isolasi sesuai risiko.

## Reasoning

OWASP Agentic 2026 menempatkan supply chain, unexpected code execution, tool poisoning, dan memory poisoning sebagai risiko utama.

## Consequences

- Script eksternal tidak pernah dijalankan di proses utama.
- Sandbox membatasi CPU, memory, waktu, filesystem, network, process, secret, output.
- Trust level bukan pengganti permission.

## Security impact

Kritis. Menjadi fondasi pertahanan terhadap plugin berbahaya.

## Migration plan

Isolasi dapat ditingkatkan bertahap (process → container → microVM) tanpa ubah kontrak.

## Review conditions

- Ada kebutuhan menjalankan kode third-party dengan akses sensitif.

## References

Dokumen 03, 04; threat model.
