# Dokumen 08 — Operations, Deployment & Production Specification

## 8.1 Deployment model

**Local development** — service lokal, test database, mock provider, debugging.

**Self-hosted** — container deployment, external database, secret management, backup, monitoring.

**Managed cloud** — tenant isolation, automated deployment, usage metering, managed upgrades, platform operations.

## 8.2 Initial deployment architecture

```
INTERNET → REVERSE PROXY → AETHER API
                              ├── CONTROL PLANE (registries, identity, policies, config, usage)
                              └── EXECUTION PLANE (agent/integration/workflow workers, event consumers)
                                          ↓
                              DATA SERVICES (PostgreSQL, Redis, Object Store)
```

MVP: semua komponen dalam satu Compose deployment. Pemisahan proses saat dibutuhkan isolasi, scaling, atau reliability.

## 8.3 Infrastructure stack

| Komponen | Pilihan awal |
| --- | --- |
| Runtime | Node.js LTS |
| Language | TypeScript |
| API | Framework Node matang |
| Validation | Schema validation library |
| Database | PostgreSQL |
| ORM/query | Evaluasi ORM & SQL layer |
| Cache | Redis |
| Queue | BullMQ atau alternatif teruji |
| Object storage | S3-compatible |
| Telemetry | OpenTelemetry |
| Containers | Docker |
| API docs | OpenAPI |
| CI | GitHub Actions |
| Secret management | Deployment-specific vault |

Pilihan library final **MUST** dikunci lewat prototype, bukan popularitas.

## 8.4 Control plane vs execution plane

Control plane: tenant management, user & identity, module/skill/plugin registry, agent definitions, capability definitions, policy config, integration config, usage & quotas.

Execution plane: agent runs, capability invocations, tool execution, workflow execution, event processing, provider connections, scheduled jobs.

## 8.5 Observability

Tiga pilar: logs, metrics, traces. Tambahkan GenAI telemetry: model calls, agent runs, tool invocations, retrieval, MCP requests, evaluation results. Manfaatkan OpenTelemetry semantic conventions untuk GenAI & MCP.

Trace tipikal:

```
HTTP Request → Authentication → Authorization → Agent Run
  → Context Retrieval → Model Inference → Skill Resolution
  → Capability Invocation (Policy Decision → Provider Request → Response)
  → Result Validation → Agent Completion
```

Chain-of-thought privat **MUST NOT** dicatat. Sensitive content capture opt-in atau dibatasi policy tenant, dengan redaction & retention jelas.

## 8.6 Metrics

```
aether_http_requests_total          aether_http_request_duration
aether_module_health                aether_agent_runs_total
aether_agent_run_duration           aether_model_requests_total
aether_model_tokens_total           aether_model_cost_estimate
aether_capability_invocations_total aether_capability_failures_total
aether_workflow_queue_depth         aether_workflow_duration
aether_event_consumer_lag           aether_approval_pending
aether_integration_connection_state
```

Label wajib berkardinalitas terkendali. User ID, prompt lengkap, arbitrary resource ID **MUST NOT** jadi label metric.

## 8.7 Reliability engineering

Wajib: health checks, readiness, graceful shutdown, timeout, retry with backoff, circuit breaker, rate limit, queue backpressure, idempotency, dead-letter handling, job reconciliation, backup, restore test, disaster recovery, incident response, capacity planning.

## 8.8 Backup & recovery

Backup mencakup PostgreSQL, object storage, secret references & key recovery material sesuai kebijakan, configuration, workflow state, audit records. Tetapkan RPO, RTO, frequency, retention, encryption, access control, restore testing frequency. RPO/RTO dipilih ber kebutuhan deployment tier, bukan sembarangan. Disaster recovery bukan sekadar backup — **harus dibuktikan dapat dipulihkan**.

## 8.9 Release engineering

```
Change Proposal → Architecture Review → Implementation → Unit Tests
→ Integration Tests → Security Checks → Compatibility Checks → Staging
→ Release Approval → Production → Post-release Monitoring
```

Release memiliki version, changelog, migration plan, rollback plan, dependency inventory, security review, test report, known issues, release owner.

## 8.10 Incident management

Setiap incident memiliki severity, impact, start time, detection source, affected components, mitigation, recovery, root cause, follow-up actions.

Runbook wajib: database unavailable; Redis unavailable; provider outage; model provider outage; queue backlog; credential compromise; tenant data exposure; agent execution loop; plugin failure; failed migration.

## 8.11 Cost management

Usage metering sejak awal. Sumber biaya: model inference, embeddings, storage, database, network, worker compute, third-party provider, observability retention. Setiap execution dapat dikaitkan dengan tenant, agent, model provider, dan capability usage.

Usage metering **MUST NOT** disamakan dengan billing. Billing domain komersial tambahan dengan rekonsiliasi & kontrol tersendiri.

## 8.12 Production readiness criteria

- [ ] Deployment reproducible
- [ ] Secrets tidak di source code
- [ ] Database backup aktif
- [ ] Restore telah diuji
- [ ] Health checks berfungsi
- [ ] Logs & traces tersedia
- [ ] Queue recovery teruji
- [ ] Rate limits aktif
- [ ] Tenant isolation diuji
- [ ] Security review selesai
- [ ] Load test selesai
- [ ] Incident runbooks tersedia
- [ ] Rollback telah diuji
- [ ] Usage metering tersedia
- [ ] Data retention policy aktif
