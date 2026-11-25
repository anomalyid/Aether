# Dokumen 05 — Agent Runtime & AI Infrastructure Specification

## 5.1 Arsitektur agent

Agent menerima tujuan, memahami konteks, memilih cara penyelesaian, menggunakan capability, dan menghasilkan hasil. Aether memisahkan: agent definition, agent version, agent configuration, agent runtime, agent execution, agent memory, agent identity, agent evaluation. Satu definition dapat memiliki banyak version dan execution.

## 5.2 Agent manifest

```yaml
id: customer-assistant
name: Customer Assistant
version: 1.0.0
runtime:
  type: aether-native
model:
  profile: balanced
instructions:
  path: ./instructions/system.md
skills: [customer-support]
capabilities:
  allowed: [knowledge.search, messaging.draft]
limits:
  maxSteps: 12
  maxToolCalls: 8
  timeoutMs: 120000
  maxBudgetUnits: 100
security:
  approvalPolicy: default
```

Angka di atas adalah contoh konfigurasi, **bukan angka produksi tervalidasi**.

## 5.3 Execution lifecycle

```
CREATED → VALIDATING → QUEUED → RUNNING → WAITING_TOOL
→ WAITING_APPROVAL → RESUMING → COMPLETED
```

Terminal: `FAILED`, `CANCELLED`, `EXPIRED`. Transisi **MUST** dikontrol runtime, bukan diputuskan bebas oleh model.

## 5.4 Orchestration

Pola awal: **supervisor** dengan specialist terbatas (Research, Execution, Review). Supervisor membuat plan, memilih specialist, mengontrol budget, mengawasi hasil, menangani kegagalan, menghentikan proses batas tercapai.

Untuk tugas sederhana, satu agent lebih efisien, lebih mudah diuji, lebih mudah diaudit. **MUST NOT** membuat multi-agent untuk semua pekerjaan.

## 5.5 Model Gateway

Seluruh provider AI berada di balik Model Gateway. Fungsi: provider registration, model discovery, request normalization, streaming, tool calling, structured output, token usage, cost estimation, timeout, retry, provider health, fallback policy.

```ts
interface ModelGateway {
  generate(request: ModelRequest, context: ModelContext): Promise<ModelResponse>;
  stream(request: ModelRequest, context: ModelContext): AsyncIterable<ModelStreamEvent>;
  embeddings(request: EmbeddingRequest, context: ModelContext): Promise<EmbeddingResponse>;
}
```

Adapter wajib mempertahankan model aktual, usage, finish reason, provider errors. Fallback **MUST NOT** terjadi diam-diam jika memengaruhi keamanan, kemampuan, biaya, atau kualitas yang dijanjikan.

Routing mengevaluasi: tool calling, structured output quality, context window, latency, availability, biaya, privasi, lokasi pemrosesan data, kesesuaian task.

Chain-of-thought privat **MUST NOT** disimpan sebagai log operasional. Simpan keputusan operasional, tool calls, status, output relevan, error, token usage, trace.

## 5.6 Context Engine

Sumber: user request, agent instructions, conversation history, skill instructions, capability metadata, retrieved knowledge, memory, workflow state, policy context.

```ts
interface ContextItem {
  id: string;
  type: "instruction" | "conversation" | "skill" | "knowledge" | "memory" | "tool_result";
  content: unknown;
  source: string;
  trust: "trusted" | "verified" | "untrusted";
  createdAt: string;
}
```

Konten dari website, dokumen, tool result, pesan eksternal **MUST NOT** diperlakukan sebagai instruksi sistem.

## 5.7 Memory System

| Jenis | Isi |
| --- | --- |
| Working | Konteks execution aktif |
| Conversation | Riwayat percakapan |
| Episodic | Pengalaman & kejadian |
| Semantic | Fakta tervalidasi |
| Procedural | Cara melakukan pekerjaan |
| Organizational | Pengetahuan organisasi |

Setiap memory memiliki owner, tenant, source, provenance, confidence, timestamp, retention, access policy, deletion lifecycle. Retrieval wajib menghormati tenant boundary dan permission sumber. Memory **MUST NOT** otomatis dianggap benar hanya karena dihasilkan AI.

## 5.8 Evaluation Engine

Sebelum agent dirilis, uji: task success, tool selection, skill selection, output schema correctness, policy compliance, hallucination rate, prompt injection resistance, latency, token consumption, cost, recovery behavior.

Setiap agent version memiliki evaluation result. Perubahan model, prompt, skill, tool **MUST** dibandingkan terhadap baseline. Simpan model, prompt, skill version, tool schema, dan dataset evaluasi.

## 5.9 Runtime budgets

```ts
interface ExecutionBudget {
  maxDurationMs: number;
  maxSteps: number;
  maxModelCalls: number;
  maxToolCalls: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxEstimatedCost?: number;
}
```

Jika budget habis, runtime menghentikan atau meminta kelanjutan sesuai policy. Agent **MUST NOT** menjalankan loop tanpa batas.

## 5.10 Acceptance criteria

- [ ] Agent version immutable
- [ ] Execution state machine valid
- [ ] Model Gateway provider-agnostic
- [ ] Tool calls melewati Capability Engine
- [ ] Context memiliki provenance
- [ ] Memory memiliki tenant isolation
- [ ] Execution memiliki budget
- [ ] Cancellation berfungsi
- [ ] Agent version dapat dievaluasi
- [ ] Multi-agent delegation tercatat
