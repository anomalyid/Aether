# Panduan AI Coding Agent — Aether

Ringkasan operasional dari `AGENTS.md`. Dokumen ini dipakai agen pengembang saat bekerja di repository.

## Sebelum memulai

1. Baca `ARCHITECTURE.md`.
2. Baca dokumen spesifikasi yang relevan di `docs/specifications/`.
3. Baca ADR yang relevan di `docs/adr/`.
4. Tentukan domain mana yang disentuh. Jangan keluar dari domain itu.

## Alur kerja yang diwajibkan

```
Requirement → Research → Architecture Review → Implementation Plan
→ Code → Unit Test → Integration Test → Security Review
→ Human Approval → Release → Monitoring
```

## Daftar periksa sebelum selesai

- [ ] `pnpm build` lulus.
- [ ] `pnpm test` lulus.
- [ ] Test baru ditambahkan untuk perilaku baru.
- [ ] Tidak ada secret di source, log, error, atau prompt.
- [ ] Tidak ada dependency baru tanpa versi dipatok dan alasan.
- [ ] Tidak ada perubahan kontrak publik tanpa ADR.
- [ ] Tidak ada circular dependency.
- [ ] Tenant boundary dan permission diperiksa.
- [ ] Dokumentasi diperbarui.

## Agent engineering yang direncanakan

| Agent | Tanggung jawab |
| --- | --- |
| Architect Agent | Menjaga konsistensi arsitektur |
| Research Agent | Riset teknologi & dokumentasi |
| Backend Agent | Implementasi backend |
| Frontend Agent | Implementasi Console |
| Integration Agent | Integrasi provider |
| Skill Builder | Membuat & memvalidasi Skills |
| MCP Engineer | Membuat MCP adapter |
| Database Agent | Schema & migration |
| Testing Agent | Unit, integration, E2E |
| Security Reviewer | Pemeriksaan keamanan |
| Performance Agent | Benchmark |
| Documentation Agent | Dokumentasi |
| DevOps Agent | CI/CD & deployment |
| Release Agent | Release checklist |

Agent pengembang bekerja dengan akses sesuai tugas. **Tidak ada agent yang boleh langsung mengubah produksi tanpa kontrol manusia.**

## Batas yang tidak boleh dilanggar

- Perubahan penting tetap melewati pemeriksaan dan persetujuan manusia.
- Agent membantu menganalisis, merancang, mengimplementasikan, menguji, dan meninjau — bukan mengambil alih keputusan arsitektur.
- Jangan mengklaim selesai hanya karena kode berjalan.
- Laporkan keterbatasan test secara jujur.

**By Anomalyid.**
