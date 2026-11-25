/**
 * Evaluation Engine — mengukur kualitas agent sebelum rilis.
 *
 * By Anomalyid.
 */

import { createId } from "@aether/identifiers";
import type { EvaluationRecord } from "./types.js";
import type { EvaluationRepository } from "./ports.js";

export const EVALUATION_DIMENSIONS = [
  "correctness",
  "grounding",
  "toolSelection",
  "skillSelection",
  "safety",
  "consistency",
  "efficiency",
  "recovery",
] as const;

export type EvaluationDimension = (typeof EVALUATION_DIMENSIONS)[number];

export class EvaluationEngine {
  constructor(private readonly repository: EvaluationRepository) {}

  async record(input: {
    agentId: string;
    agentVersion: string;
    tenantId: string;
    runId: string;
    dimensions: Partial<Record<EvaluationDimension, number>>;
  }): Promise<EvaluationRecord> {
    const dims: Record<string, number> = {};
    for (const dimension of EVALUATION_DIMENSIONS) {
      dims[dimension] = input.dimensions[dimension] ?? 0;
    }
    const record: EvaluationRecord = {
      id: createId("eval"),
      agentId: input.agentId,
      agentVersion: input.agentVersion,
      tenantId: input.tenantId,
      runId: input.runId,
      dimensions: dims,
      createdAt: new Date().toISOString(),
    };
    await this.repository.save(record);
    return record;
  }

  async list(agentId: string, version?: string): Promise<EvaluationRecord[]> {
    return this.repository.listByAgent(agentId, version);
  }

  async lolosGate(
    agentId: string,
    version: string,
    minimum: Partial<Record<EvaluationDimension, number>>,
  ): Promise<boolean> {
    const records = await this.repository.listByAgent(agentId, version);
    const terakhir = records.at(-1);
    if (terakhir === undefined) return false;
    return Object.entries(minimum).every(
      ([key, value]) => (terakhir.dimensions[key] ?? 0) >= value,
    );
  }
}
