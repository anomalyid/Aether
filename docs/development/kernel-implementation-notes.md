# Catatan Implementasi Kernel — Bukti dan Batas

Dokumen ini mencatat apa yang **benar-benar** sudah dibangun, terpisah dari yang masih berupa rancangan. Disusun untuk mencegah klaim berlebihan.

## Status: sudah diimplementasi dan diuji

| Komponen | Lokasi | Bukti |
| --- | --- | --- |
| Contract Registry types | `packages/contracts` | Build + import oleh semua package |
| Taksonomi error + redaksi secret | `packages/errors` | `index.test.ts` |
| Identifier generator | `packages/identifiers` | `index.test.ts` (1000 ID unik) |
| Config loader + env interpolation | `packages/configuration` | `index.test.ts` |
| Execution context (AsyncLocalStorage) | `packages/context` | `index.test.ts` |
| Dependency graph + deteksi siklus | `packages/kernel/src/dependency-graph.ts` | `dependency-graph.test.ts` |
| DI container (singleton/scoped/transient) | `packages/kernel/src/container.ts` | `container.test.ts` |
| State machine lifecycle | `packages/kernel/src/lifecycle.ts` | `lifecycle.test.ts` |
| Resource registry + reverse disposal | `packages/kernel/src/resource-registry.ts` | `resource-registry.test.ts` |
| Manifest validation & module registry | `packages/kernel/src/module-registry.ts` | `module-registry.test.ts` |
| Health manager (live/ready/deps) | `packages/kernel/src/health.ts` | `health.test.ts` |
| Bootstrap + rollback + graceful shutdown | `packages/kernel/src/bootstrap.ts` | `bootstrap.test.ts` |
| Semver compatibility check | `packages/kernel/src/version.ts` | `version.test.ts` |

Perintah verifikasi:

```bash
pnpm build   # TypeScript composite build, strict mode
pnpm test    # 12 file test, 69 test case
```

Hasil terakhir: **build lulus, 69/69 test lulus.**

## Keputusan implementasi yang perlu dicatat

1. **Shutdown dua fase.** Seluruh modul di-`stop()` dalam urutan terbalik dependency, baru kemudian seluruhnya di-`dispose()` dalam urutan terbalik. Ini sesuai Dokumen 02 §2.12 dan ditemukan melalui test yang gagal saat implementasi awal mencampur keduanya.
2. **`requestPermissions()` hanya mencatat.** Pemberian izin sesungguhnya berada di domain Security yang belum dibangun. Tidak boleh dianggap sebagai authorization.
3. **Config disaring sebelum diberikan ke modul.** Modul menerima config yang sudah di-redact; akses secret harus melalui vault (belum dibangun).
4. **Validation permission opsional.** `knownPermissions` dapat disediakan oleh caller; jika tidak, hanya format permission yang divalidasi. Pengaitan ke registry permission nyata menunggu domain Security.
5. **Health check gagal → unhealthy, bukan melempar.** Satu check yang gagal tidak boleh membuat seluruh endpoint health gagal.

## Yang belum diimplementasi (dilarang diklaim selesai)

- Domain Identity, Security, Capability, Agent, Skills, Plugin, Protocol, Integration, Workflow, Knowledge, Data, Operations, Developer.
- API HTTP/OpenAPI, database schema & migration, SDK, CLI.
- MCP client/server, A2A adapter, WhatsApp adapter.
- Security audit, load test, recovery test, production deployment.
- Clearancy merek PDKI/WIPO.

## Langkah implementasi berikutnya

Sesuai urutan yang tidak boleh dibalik: **Identity & data foundation**, lalu **Security & trust**, lalu **Capability infrastructure**.
