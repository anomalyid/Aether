# Dokumen 02 — Core Kernel Specification

## 2.1 Tujuan

Aether Core adalah fondasi runtime yang menyediakan mekanisme umum bagi seluruh modul platform. Core **tidak** menjadi AI, mengirim WhatsApp, menjalankan workflow bisnis, atau mengelola marketplace.

Tanggung jawab Core: module discovery & registration; lifecycle management; dependency resolution; dependency injection; contract registration; configuration management; application bootstrap; resource ownership & disposal; error propagation; health management; internal event interfaces; runtime context propagation; graceful shutdown; compatibility validation.

## 2.2 Prinsip kernel

| ID | Prinsip | Aturan |
| --- | --- | --- |
| CORE-001 | Minimal kernel | Hanya primitive umum |
| CORE-002 | Explicit dependencies | Dependensi dideklarasikan |
| CORE-003 | Deterministic startup | Urutan startup dapat ditentukan |
| CORE-004 | Controlled lifecycle | Modul memiliki lifecycle formal |
| CORE-005 | Fail fast | Kesalahan konfigurasi terdeteksi sebelum serving |
| CORE-006 | No hidden global state | State penting memiliki owner |
| CORE-007 | Resource cleanup | Resource dapat dilepas |
| CORE-008 | Contract validation | Kontrak diperiksa saat registration |
| CORE-009 | Observable lifecycle | Perubahan lifecycle tercatat |
| CORE-010 | Reproducible bootstrap | Konfigurasi sama → bootstrap konsisten |

## 2.3 Package boundaries

```
packages/
├── kernel/          bootstrap, lifecycle, modules, dependency-graph,
│                    container, contracts, configuration, context,
│                    resources, health, errors
├── contracts/       common, module, events, execution, identity
├── configuration/   schema loading, env interpolation, redaction
├── context/         propagasi context
├── errors/          taxonomy, normalisasi
└── identifiers/     pembangkit ID
```

Aturan: kernel **MUST NOT** mengimpor domain modules; contracts **MUST NOT** mengimpor implementasi runtime; domain modules **MAY** bergantung pada contracts; adapters **MAY** mengimplementasikan contracts; dependency graph **MUST** bebas circular dependency.

## 2.4 Module System

Modul adalah unit komposisi utama. Contoh: Identity, Security, Capability, Agent Runtime, Skill Engine, MCP, Workflow, Integration, Observability. Setiap modul wajib memiliki manifest, dependencies, contracts, lifecycle, konfigurasi, dan health check.

### 2.4.1 Module manifest (YAML, kontrak internal)

```yaml
id: aether.identity
name: Aether Identity
version: 1.0.0
description: Identity and principal management
runtime:
  package: "@aether/identity"
  entrypoint: "./dist/index.js"
compatibility:
  kernel: "^0.1.0"
  contracts: "^0.1.0"
dependencies:
  required: [aether.database]
  optional: [aether.audit]
provides:
  contracts: [identity.principal.v1, identity.tenant.v1]
requires:
  contracts: [database.connection.v1]
permissions:
  requested: [identity.read, identity.manage]
lifecycle:
  startupPriority: 100
  shutdownTimeoutMs: 10000
health:
  enabled: true
```

Validasi wajib: ID unik; semantic version valid; entrypoint tersedia; compatibility range valid; dependency terdaftar; tidak circular; contract requirements terpenuhi; permission dikenal; lifecycle valid; provenance sesuai kebijakan. Manifest gagal validasi **MUST NOT** diaktifkan.

### 2.4.2 Module lifecycle

```
DISCOVERED → VALIDATING → RESOLVING → REGISTERING → INITIALIZING
→ STARTING → READY → STOPPING → STOPPED
```

Failure states: `VALIDATION_FAILED`, `DEPENDENCY_FAILED`, `INITIALIZATION_FAILED`, `START_FAILED`, `UNHEALTHY`.

```
discover() → validate() → resolve() → register() → initialize()
→ start() → ready() → stop() → dispose()
```

`stop()` dan `dispose()` **MUST** idempotent. Jika startup gagal di tengah, kernel **MUST** membersihkan resource modul yang sudah sukses diinisialisasi dalam **urutan terbalik dependency**.

### 2.4.3 Lifecycle contract

```ts
export interface AetherModule {
  readonly manifest: ModuleManifest;
  register(context: RegistrationContext): Promise<void>;
  initialize(context: ModuleContext): Promise<void>;
  start(context: ModuleContext): Promise<void>;
  healthCheck?(context: ModuleContext): Promise<HealthResult>;
  stop(context: ModuleContext): Promise<void>;
  dispose(context: ModuleContext): Promise<void>;
}
```

- `register()` hanya mendaftarkan service & contract.
- `initialize()` memvalidasi konfigurasi dan menyiapkan resource.
- `start()` memulai consumer/worker/background process.
- `healthCheck()` **MUST NOT** mengubah state bisnis.
- `stop()` menghentikan penerimaan pekerjaan baru.
- `dispose()` membersihkan resource milik modul.
- **MUST NOT** membuka koneksi eksternal atau background worker saat file module di-import.

## 2.5 Dependency Injection

```ts
interface ServiceToken<T> { readonly id: string; readonly version: number; }
interface ServiceProvider<T> {
  token: ServiceToken<T>;
  lifetime: "singleton" | "scoped" | "transient";
  factory: (context: ResolutionContext) => T | Promise<T>;
}
interface DependencyContainer {
  register<T>(provider: ServiceProvider<T>): void;
  resolve<T>(token: ServiceToken<T>): Promise<T>;
  createScope(context: ScopeContext): DependencyScope;
  dispose(): Promise<void>;
}
```

| Lifetime | Perilaku | Contoh |
| --- | --- | --- |
| Singleton | Satu instance per container | Database pool |
| Scoped | Satu instance per scope | Request context |
| Transient | Instance baru setiap permintaan | Helper ringan |

Aturan: singleton **MUST NOT** menyimpan data user; scoped **MUST NOT** keluar dari scope; transient **MUST NOT** diam-diam membuat resource jangka panjang; dependency lifetime lebih panjang **MUST NOT** menangkap dependency lifetime lebih pendek.

DI wajib memiliki: duplicate detection, missing dependency detection, circular detection, lifetime validation, scope cleanup, resolution tracing, safe disposal.

## 2.6 Contract Registry

Contoh contract: `identity.principal.v1`, `security.authorization.v1`, `capability.execution.v1`, `agent.runtime.v1`, `workflow.execution.v1`, `event.publisher.v1`, `telemetry.tracer.v1`.

Mampu: mendaftar; memeriksa versi; menyelesaikan provider; menolak provider ganda eksklusif; compatibility check; dependency graph; melacak pemakai; diagnostic report. Contract **MUST NOT** hanya berupa string tanpa schema dan dokumentasi. Breaking change **MUST** menaikkan major version.

## 2.7 Configuration Management

Sumber: default → file → environment → secret reference → deployment override. Prioritas wajib konsisten dan terdokumentasi.

```yaml
aether:
  environment: development
  runtime: { shutdownTimeoutMs: 30000, startupTimeoutMs: 60000 }
  database:
    url: ${AETHER_DATABASE_URL}
    pool: { min: 2, max: 10 }
  observability:
    tracing: { enabled: true }
```

Wajib: schema validation saat startup; unknown key detection; type validation; required field validation; secret reference resolution; safe redaction; provenance; reload policy; immutable startup config; explicit dynamic config support. Secret **MUST NOT** masuk log atau config biasa. Setiap field menyatakan apakah perubahan butuh restart.

## 2.8 Runtime Context

```ts
interface AetherExecutionContext {
  requestId: string;
  correlationId: string;
  traceId?: string;
  tenantId?: string;
  principalId?: string;
  actorType: "user" | "agent" | "system" | "service";
  executionId?: string;
  agentRunId?: string;
  deadline?: string;
  cancellationSignal?: AbortSignal;
}
```

Context hanya metadata minimum — bukan tempat menyimpan data user, secret, atau hasil retrieval. Wajib diteruskan ke operasi async; tenant ID berasal dari identitas tervalidasi; client tidak bebas menentukan principal; cancellation dan deadline diteruskan.

## 2.9 Resource Management

| Resource | Owner |
| --- | --- |
| Database pool | Database adapter |
| Redis connection | Cache adapter |
| Queue consumer | Worker module |
| HTTP server | API application |
| Timer/background loop | Modul pembuatnya |
| Temporary file | Execution scope |
| External session | Integration module |

```ts
interface Disposable { dispose(): Promise<void>; }
interface ResourceRegistry { register(resource: Disposable): void; disposeAll(): Promise<void>; }
```

Cleanup memakai urutan terbalik pembuatan jika dependensi bersarang.

## 2.10 Error System

```ts
interface AetherError {
  code: string;
  message: string;
  category: "validation" | "dependency" | "authorization" | "execution" | "infrastructure" | "internal";
  retryable: boolean;
  retryAfterMs?: number;
  requestId?: string;
  details?: Record<string, unknown>;
}
```

Stack trace **MUST NOT** dikembalikan ke pengguna. Secret **MUST NOT** masuk details. Error provider wajib dinormalisasi. Retry wajib memperhitungkan idempotency.

Kode: `KERNEL_MODULE_NOT_FOUND`, `KERNEL_MODULE_DUPLICATE`, `KERNEL_MODULE_CYCLE`, `KERNEL_MODULE_START_FAILED`, `KERNEL_DEPENDENCY_MISSING`, `KERNEL_CONTRACT_MISMATCH`, `KERNEL_CONFIG_INVALID`, `KERNEL_SERVICE_NOT_FOUND`, `KERNEL_SCOPE_DISPOSED`, `KERNEL_SHUTDOWN_TIMEOUT`.

## 2.11 Bootstrap & Shutdown

Startup: load environment → parse config → validate config → init logger/telemetry → discover modules → validate manifests → resolve graph → register contracts → init modules → start adapters → start platform modules → start API/workers → verify readiness → accept traffic.

Shutdown: mark not ready → stop new traffic → stop scheduling → drain requests → stop consumers → stop agent workers → stop integration workers → stop modules reverse dependency → flush telemetry → close pools → dispose resources → exit.

Shutdown memiliki global timeout dan per-module timeout. Jika terlampaui, catat resource yang belum dibersihkan dan lanjutkan sesuai kebijakan operasional.

## 2.12 Health Management

Liveness (proses hidup), Readiness (siap menerima traffic), Dependency health (dependensi penting berfungsi). Endpoint: `GET /health/live`, `/health/ready`, `/health/dependencies`. Health check **MUST NOT** membocorkan credential, alamat internal sensitif, atau konfigurasi rahasia.

## 2.13 Testing Requirements

Unit: manifest validation, dependency graph, lifecycle transitions, DI resolution, contract registration, config validation, error mapping, resource cleanup. Integration: startup banyak modul, dependency gagal, circular detection, partial rollback, graceful shutdown, scope cleanup. Property-based: urutan graph benar, lifecycle tidak melompat, duplikat terdeteksi, disposal aman. Fault injection: database/Redis unavailable, startup timeout, contract mismatch, disposal failure, telemetry exporter failure.

Kernel wajib tetap memberi diagnosis berguna meski telemetry backend mati.

## 2.14 Acceptance Criteria

- [x] Module manifest dapat divalidasi
- [x] Dependency graph dapat diselesaikan
- [x] Circular dependency ditolak
- [x] Lifecycle state machine berfungsi
- [x] Startup rollback berfungsi
- [x] DI mendukung lifetime singleton/scoped/transient
- [x] Contract Registry mendeteksi mismatch
- [x] Configuration schema tervalidasi
- [x] Secret berhasil di-redact
- [x] Context dapat diteruskan
- [x] Resource cleanup dapat diuji
- [x] Shutdown graceful
- [x] Health endpoints tersedia (via HealthManager)
- [x] Error taxonomy konsisten
- [x] Unit, integration, fault-injection tests lulus
