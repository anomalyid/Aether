/**
 * Model Gateway — satu lapisan akses untuk seluruh provider AI.
 *
 * Agent tidak pernah bergantung langsung pada provider tertentu.
 * Fallback hanya terjadi bila diizinkan dan selalu dicatat.
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode, normalizeError } from "@aether/errors";
import type {
  ExecutionBudget,
  GenerationResult,
  ModelProvider,
  ModelRequest,
} from "./types.js";

export interface GenerateOptions {
  preferredProvider?: string;
  allowFallback?: boolean;
  budget?: ExecutionBudget;
}

export interface UsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  requests: number;
}

export class ModelGateway {
  private readonly providers = new Map<string, ModelProvider>();
  private readonly usage: UsageSnapshot = {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    requests: 0,
  };

  register(provider: ModelProvider): void {
    if (this.providers.has(provider.id)) {
      throw new AetherError(
        ErrorCode.RESOURCE_CONFLICT,
        `Model provider ${provider.id} sudah terdaftar.`,
        { category: "execution", retryable: false },
      );
    }
    this.providers.set(provider.id, provider);
  }

  listProviders(): string[] {
    return [...this.providers.keys()];
  }

  getUsage(): UsageSnapshot {
    return { ...this.usage };
  }

  async generate(
    request: ModelRequest,
    options: GenerateOptions = {},
  ): Promise<GenerationResult> {
    const ordered = this.orderProviders(options.preferredProvider);
    if (ordered.length === 0) {
      throw new AetherError(
        ErrorCode.DEPENDENCY_UNAVAILABLE,
        "Tidak ada model provider yang terdaftar.",
        { category: "infrastructure", retryable: true },
      );
    }

    const errors: string[] = [];
    let fallbackUsed = false;

    for (let index = 0; index < ordered.length; index += 1) {
      const provider = ordered[index];
      if (provider === undefined) continue;
      const isFallback = index > 0;

      try {
        const response = await provider.generate(request);
        this.enforceBudget(response, options.budget);
        this.recordUsage(response);
        return {
          response,
          providerId: provider.id,
          fallbackUsed,
          attempts: index + 1,
        };
      } catch (error) {
        const normalized = normalizeError(error, ErrorCode.PROVIDER_UNAVAILABLE);
        if (normalized.code === "POLICY_BLOCKED") throw normalized;
        errors.push(`${provider.id}: ${normalized.message}`);
        if (isFallback === false && (options.allowFallback ?? false) === false) break;
        fallbackUsed = true;
      }
    }

    throw new AetherError(
      ErrorCode.PROVIDER_UNAVAILABLE,
      "Seluruh model provider gagal melayani permintaan.",
      { category: "infrastructure", retryable: true, details: { errors } },
    );
  }

  private orderProviders(preferred?: string): ModelProvider[] {
    const all = [...this.providers.values()];
    if (preferred === undefined) return all;
    const selected = all.find((provider) => provider.id === preferred);
    if (selected === undefined) return all;
    return [selected, ...all.filter((provider) => provider.id !== preferred)];
  }

  private enforceBudget(
    response: Awaited<ReturnType<ModelProvider["generate"]>>,
    budget: ExecutionBudget | undefined,
  ): void {
    if (budget === undefined) return;
    if (
      budget.maxInputTokens !== undefined &&
      response.usage.inputTokens > budget.maxInputTokens
    ) {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "Budget token input terlampaui.", {
        category: "authorization",
        retryable: false,
      });
    }
    if (
      budget.maxOutputTokens !== undefined &&
      response.usage.outputTokens > budget.maxOutputTokens
    ) {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "Budget token output terlampaui.", {
        category: "authorization",
        retryable: false,
      });
    }
    if (
      budget.maxEstimatedCost !== undefined &&
      (response.usage.estimatedCost ?? 0) > budget.maxEstimatedCost
    ) {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "Budget biaya model terlampaui.", {
        category: "authorization",
        retryable: false,
      });
    }
  }

  private recordUsage(response: Awaited<ReturnType<ModelProvider["generate"]>>): void {
    this.usage.inputTokens += response.usage.inputTokens;
    this.usage.outputTokens += response.usage.outputTokens;
    this.usage.estimatedCost += response.usage.estimatedCost ?? 0;
    this.usage.requests += 1;
  }
}
