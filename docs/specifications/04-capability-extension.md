# Dokumen 04 — Capability, Skills & Plugins Specification

## 4.1 Capability system sebagai pusat

Agent tidak boleh mengetahui seluruh implementasi sistem eksternal. Agent hanya perlu tahu capability apa yang tersedia, cara memanggilnya, syaratnya, dan batas izinnya.

```
Capability: messaging.send
Provider:   WhatsApp | Telegram | Email
Input:      recipient, content
Output:     message_id, status
Policy:     messaging.send
Execution:  controlled by Aether
```

## 4.2 Perbedaan komponen (wajib dipertahankan di codebase)

| Komponen | Makna |
| --- | --- |
| Capability | Operasi yang dapat dilakukan |
| Tool | Interface yang memanggil capability |
| Skill | Petunjuk prosedural menyelesaikan tugas |
| Plugin | Paket distribusi ekstensi |
| Agent | Entitas yang merencanakan & menjalankan task |
| Workflow | Urutan proses yang dapat dieksekusi |
| Integration | Adapter ke sistem eksternal |
| MCP | Protokol interoperabilitas |

## 4.3 Capability contract

```ts
interface CapabilityDefinition {
  id: string;
  version: string;
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  riskLevel: "low" | "medium" | "high" | "critical";
  permissions: string[];
  idempotency: "required" | "supported" | "unsupported";
  timeoutMs: number;
}
```

Wajib memiliki: unique ID, version, description, input/output schema, permission requirements, risk classification, timeout, idempotency semantics, owner, provider mapping, dokumentasi.

## 4.4 Capability registry

Menyimpan metadata, **bukan credential provider**. Fungsi: register, discover, resolve provider, validate schema, check compatibility, disable, deprecate, track invocation, enforce tenant visibility. Registry membedakan capability global, tenant-specific, dan agent-specific.

## 4.5 Execution pipeline (kanonik)

```
REQUEST → AUTHENTICATE → RESOLVE CAPABILITY → VALIDATE INPUT → CHECK TENANT
→ AUTHORIZE → RISK EVALUATION → APPROVAL IF REQUIRED → EXECUTE PROVIDER
→ VALIDATE OUTPUT → AUDIT → RETURN RESULT
```

Model AI **MUST NOT** mengeksekusi function secara langsung tanpa pipeline ini. Tidak ada jalur pintas hanya karena Skill menyuruh.

## 4.6 Idempotency & retries

Setiap invocation memiliki execution ID dan idempotency key bila didukung. Keadaan yang harus dibedakan: berhasil; gagal sebelum aksi eksternal; gagal setelah aksi eksternal; status eksternal belum diketahui; menunggu approval; dibatalkan.

Jika timeout setelah provider menerima aksi, Aether **MUST NOT** mengirim ulang tanpa reconciliation.

## 4.7 Skills Engine

Format kompatibel Agent Skills:

```
example-skill/
├── SKILL.md          # WAJIB: frontmatter + instruksi
├── scripts/          # opsional: kode executable
├── references/       # opsional: dokumentasi
└── assets/           # opsional: template & resource
```

Frontmatter wajib: `name` (1–64 char, lowercase + hyphen, harus sama dengan nama folder), `description` (1–1024 char, menjelaskan apa & kapan dipakai). Opsional: `license`, `compatibility` (≤500 char), `metadata`, `allowed-tools` (eksperimental).

Progressive disclosure: (1) metadata ~100 token dimuat saat startup; (2) isi `SKILL.md` (<5000 token disarankan, <500 baris) dimuat saat skill aktif; (3) resource dimuat saat dibutuhkan.

Lifecycle:

```
DISCOVERED → PARSED → VALIDATED → SECURITY_SCANNED → DEPENDENCIES_RESOLVED
→ REGISTERED → ENABLED → DISABLED → UNINSTALLED
```

Skill **MUST NOT** otomatis memiliki permission hanya karena terpasang. Trust level: Built-in, Verified, Organization, Community, Untrusted. Trust level bukan pengganti permission.

## 4.8 Plugin Manager

Plugin dapat berisi: module, skills, capability definitions, provider adapters, workflow templates, UI extensions, dokumentasi, configuration schemas.

Manifest: `id`, `version`, `publisher`, `aether.minimumVersion`, `components`, `permissions.requested`, `execution.isolation`.

Supply chain wajib: publisher identity, package signature, checksum, dependency pinning, vulnerability scanning, license metadata, version provenance, revocation, uninstall cleanup, compatibility check. Plugin tidak kompatibel/tidak terverifikasi **MUST NOT** diaktifkan otomatis.

## 4.9 Sandboxed execution

Script eksternal **MUST NOT** dijalankan di proses utama Aether.

| Jenis | Eksekusi |
| --- | --- |
| Metadata & instruksi | Loader terkontrol |
| Trusted internal extension | Process boundary |
| Third-party scripts | Sandbox terisolasi |
| High-risk code | Dedicated isolated runtime |

Batas sandbox: CPU, memory, execution time, filesystem, network, process spawning, secrets, output size.

## 4.10 Acceptance criteria

- [ ] Capability registry berfungsi
- [ ] Capability memiliki schema & permission
- [ ] Execution melewati policy pipeline
- [ ] Input & output divalidasi
- [ ] Idempotency sesuai kemampuan provider
- [ ] Skill metadata divalidasi
- [ ] Skill tidak otomatis mendapat permission
- [ ] Plugin memiliki provenance
- [ ] Plugin dapat dinonaktifkan & dihapus
- [ ] Eksekusi eksternal terisolasi
