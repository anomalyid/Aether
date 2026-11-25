/**
 * Propagasi execution context berbasis AsyncLocalStorage.
 *
 * Context diteruskan ke seluruh operasi asynchronous tanpa menjadikannya
 * global state yang tersembunyi.
 *
 * By Anomalyid.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { AetherExecutionContext, ActorType } from "@aether/contracts";
import { AetherError, ErrorCode } from "@aether/errors";
import {
  createCorrelationId,
  createExecutionId,
  createRequestId,
  createTraceId,
} from "@aether/identifiers";

const storage = new AsyncLocalStorage<AetherExecutionContext>();

export type ContextInput = Partial<AetherExecutionContext> &
  Pick<AetherExecutionContext, "actorType">;

export function createExecutionContext(input: ContextInput): AetherExecutionContext {
  const actorType: ActorType = input.actorType;
  return {
    requestId: input.requestId ?? createRequestId(),
    correlationId: input.correlationId ?? createCorrelationId(),
    traceId: input.traceId ?? createTraceId(),
    actorType,
    ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
    ...(input.principalId === undefined ? {} : { principalId: input.principalId }),
    ...(input.executionId === undefined ? {} : { executionId: input.executionId }),
    ...(input.agentRunId === undefined ? {} : { agentRunId: input.agentRunId }),
    ...(input.deadline === undefined ? {} : { deadline: input.deadline }),
    ...(input.cancellationSignal === undefined ? {} : { cancellationSignal: input.cancellationSignal }),
  };
}

export type { AetherExecutionContext } from "@aether/contracts";

export function runWithContext<T>(context: AetherExecutionContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getContext(): AetherExecutionContext | undefined {
  return storage.getStore();
}

export function requireContext(): AetherExecutionContext {
  const context = storage.getStore();
  if (context === undefined) {
    throw new AetherError(
      ErrorCode.KERNEL_CONTEXT_REQUIRED,
      "Execution context tidak tersedia. Gunakan runWithContext sebelum memanggil operasi yang membutuhkannya.",
      { category: "validation", retryable: false },
    );
  }
  return context;
}

/** Membuat context turunan dengan identitas request baru tetapi correlation id sama. */
export function forkContext(
  overrides: Partial<AetherExecutionContext>,
): AetherExecutionContext {
  const parent = requireContext();
  return createExecutionContext({
    ...parent,
    ...overrides,
    requestId: overrides.requestId ?? createRequestId(),
    correlationId: parent.correlationId,
  });
}

export function createSystemContext(overrides: Partial<AetherExecutionContext> = {}): AetherExecutionContext {
  return createExecutionContext({ ...overrides, actorType: "system" });
}

export function newExecutionId(): string {
  return createExecutionId();
}
