# Dokumen 03 — Identity, Security & Trust Specification

Keputusan utama: **AI Agent bukan pemilik izin tanpa batas.** Agent bertindak sebagai principal yang memiliki identitas, scope, batas penggunaan, dan delegasi izin eksplisit.

## 3.1 Identity architecture

| Identity | Fungsi |
| --- | --- |
| User | Manusia pengguna platform |
| Tenant | Batas organisasi dan kepemilikan data |
| Membership | Hubungan user–tenant |
| Service Principal | Identitas service internal |
| Agent Principal | Identitas agent |
| Integration Principal | Identitas koneksi eksternal |
| Workload Identity | Identitas proses/worker |

Satu user boleh anggota banyak tenant. Satu tenant boleh memiliki banyak agent, integration, service principal. `user_id`, `tenant_id`, `agent_id`, dan `principal_id` **MUST NOT** disamakan.

## 3.2 Identity data model

```
users(id, email, display_name, status, created_at, updated_at)
tenants(id, name, slug, status, created_at)
tenant_memberships(id, tenant_id, user_id, role_id, status, created_at)
principals(id, tenant_id, principal_type, subject_id, status, created_at)
roles(id, tenant_id, name)
permissions(id, key, description)
role_permissions(role_id, permission_id)
service_accounts(id, tenant_id, principal_id, status)
```

Setiap tabel berisi resource tenant **MUST** memiliki `tenant_id` kecuali tabel global.

## 3.3 Authentication

Adapter: email/password; OAuth 2.0 / OpenID Connect; enterprise SSO (tahap berikutnya); service-to-service; API credentials untuk integrasi yang memang butuh.

- OIDC untuk identitas pengguna; OAuth untuk delegated access.
- Short-lived access token; refresh token rotation; revocation didukung.
- Rate limiting pada login.
- **MUST NOT** membangun algoritma kriptografi sendiri.
- Authentication menjawab "siapa kamu"; authorization menjawab "apa yang boleh kamu lakukan". Keduanya terpisah.

## 3.4 Authorization model

Kombinasi RBAC + ABAC + relationship-based (jika relasi kompleks) + capability-scoped permission untuk aksi agent.

Permission granular: `agent.read/create/update/run/delete`, `skill.read/install/enable/disable`, `capability.discover/invoke`, `integration.read/connect/disconnect`, `workflow.create/run/cancel`, `approval.read/grant/reject`, `audit.read`, `tenant.manage`.

`agent.run` **MUST NOT** otomatis berarti agent boleh mengirim pesan, menghapus data, atau mengakses seluruh integrasi.

## 3.5 Policy decision pipeline

```ts
interface PolicyDecision {
  decision: "allow" | "deny" | "require_approval";
  policyIds: string[];
  reasonCode: string;
  obligations: string[];
  expiresAt?: string;
}
```

Keputusan `allow` **MUST NOT** berlaku selamanya. Untuk operasi sensitif, keputusan terikat pada principal, resource, capability, dan parameter yang dievaluasi.

## 3.6 Delegation & agent permissions

```
User → Agent Principal → Delegated Permission → Capability Invocation → External Provider
```

- Agent **MUST NOT** memperluas izin user.
- Delegasi memiliki expiry, scope, dan dapat dicabut.
- Agent **MUST NOT** meneruskan token mentah user ke server lain.
- Tool baru tidak otomatis mewarisi semua permission agent.
- Setiap delegation memiliki audit record.

## 3.7 Approval system

| Risiko | Contoh |
| --- | --- |
| Rendah | Membaca data yang sudah diizinkan |
| Menengah | Membuat draft / perubahan dapat dibatalkan |
| Tinggi | Komunikasi eksternal, perubahan data penting |
| Kritis | Operasi finansial, perubahan akses, penghapusan besar |

Klasifikasi final berbasis konteks & dampak, bukan hanya nama tool.

Approval record: `approval_id`, `tenant_id`, `requester_principal_id`, `agent_run_id`, `capability_id`, `resource_reference`, `parameter_digest`, `risk_level`, `decision`, `approver_principal_id`, `created_at`, `expires_at`, `resolved_at`.

Approval **MUST** terikat pada aksi dan parameter tepat. Jika parameter berubah, approval lama **MUST NOT** dipakai ulang. Approval kedaluwarsa memiliki state yang jelas.

## 3.8 Secrets & credential vault

Wajib: encryption at rest & in transit; key management; credential rotation; secret versioning; access audit; redaction; revocation; tenant-scoped access; backup protection. Gunakan envelope encryption sesuai deployment.

Secret **MUST NOT** masuk: prompt agent, tool description, application log, error message, analytics event, source code, public skill package.

## 3.9 Threat model

Lihat [`../security/threat-model.md`](../security/threat-model.md). Ringkasan ancaman & mitigasi: prompt injection → isolasi instruksi/data; tool misuse → policy + validasi; privilege escalation → delegation scope + deny-by-default; tenant leakage → isolasi + authorization; malicious plugin → provenance, review, sandbox; credential theft → vault + token isolation; memory poisoning → provenance & trust label; rogue agent → run limit, revocation, monitoring; MCP token misuse → audience validation & token separation; cascading failures → budget, circuit breaker, kill switch.

Prinsip **least agency**: berikan agent hanya otonomi & akses yang benar-benar dibutuhkan, hanya selama dibutuhkan.

## 3.10 Acceptance criteria

- [ ] Semua principal memiliki identitas eksplisit
- [ ] Semua resource tenant diperiksa kepemilikannya
- [ ] Permission default deny
- [ ] Agent tidak dapat menaikkan privilege sendiri
- [ ] Delegasi dapat dicabut
- [ ] Approval terikat pada parameter
- [ ] Secret tidak muncul di log
- [ ] Plugin untrusted tidak berjalan di proses utama
- [ ] Audit mencatat keputusan authorization
- [ ] Security test mencakup prompt injection & tenant isolation
