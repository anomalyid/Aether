# ADR-003 — Internal Capability Contract sebagai Kontrak Kanonis

- **Status:** Accepted
- **Tanggal:** 2026-11-25

## Context

Agent, Tools, MCP, SDK, dan integrasi semuanya perlu memanggil kemampuan. Tanpa kontrak tunggal, tiap jalur akan punya aturan berbeda.

## Decision

**Capability API internal Aether** menjadi kontrak kanonis. MCP, SDK, dan integrasi bertindak sebagai adapter terhadap kontrak ini.

## Reasoning

Mencegah jalur pintas, memungkinkan policy/authorization/audit terpusat, dan membuat agent tidak bergantung pada library provider.

## Consequences

- Setiap capability wajib: id, version, schema, permission, risk, timeout, idempotency.
- Pipeline eksekusi wajib dilewati semua pemanggil.

## Security impact

Positive: satu titik enforcement. Negative: jika ada adapter yang bypass, seluruh kontrol hilang — karenanya dilarang eksplisit.

## Migration plan

Perubahan kontrak menaikkan major version + deprecation window.

## Review conditions

- Kontrak terbukti terlalu kaku untuk kebutuhan nyata.

## References

Dokumen 04; ADR-019 (proposed).
