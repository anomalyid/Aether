/**
 * State machine lifecycle modul (CORE-004, CORE-009).
 *
 * By Anomalyid.
 */

import type { ModuleState, TransitionRecord } from "@aether/contracts";
import { AetherError, ErrorCode } from "@aether/errors";

const TRANSITIONS: Record<ModuleState, readonly ModuleState[]> = {
  DISCOVERED: ["VALIDATING"],
  VALIDATING: ["RESOLVING", "VALIDATION_FAILED"],
  RESOLVING: ["REGISTERING", "DEPENDENCY_FAILED"],
  REGISTERING: ["INITIALIZING", "DEPENDENCY_FAILED"],
  INITIALIZING: ["STARTING", "INITIALIZATION_FAILED"],
  STARTING: ["READY", "START_FAILED"],
  READY: ["STOPPING", "UNHEALTHY"],
  UNHEALTHY: ["STOPPING", "READY"],
  VALIDATION_FAILED: ["STOPPING"],
  DEPENDENCY_FAILED: ["STOPPING"],
  INITIALIZATION_FAILED: ["STOPPING"],
  START_FAILED: ["STOPPING"],
  STOPPING: ["STOPPED"],
  STOPPED: [],
};

export { TRANSITIONS as MODULE_TRANSITIONS };

export function isTerminalState(state: ModuleState): boolean {
  return state === "STOPPED";
}

export class LifecycleMachine {
  private current: ModuleState = "DISCOVERED";
  private readonly records: TransitionRecord[] = [];

  constructor(private readonly moduleId: string) {}

  get state(): ModuleState {
    return this.current;
  }

  can(next: ModuleState): boolean {
    return TRANSITIONS[this.current].includes(next);
  }

  transition(next: ModuleState, reason?: string): void {
    if (!this.can(next)) {
      throw new AetherError(
        ErrorCode.KERNEL_LIFECYCLE_INVALID,
        `Transisi lifecycle ${this.current} → ${next} tidak diizinkan untuk modul ${this.moduleId}.`,
        {
          category: "execution",
          retryable: false,
          details: { moduleId: this.moduleId, from: this.current, to: next },
        },
      );
    }

    const record: TransitionRecord = {
      from: this.current,
      to: next,
      at: new Date().toISOString(),
      ...(reason === undefined ? {} : { reason }),
    };
    this.records.push(record);
    this.current = next;
  }

  /** Transisi cleanup yang aman: hanya dilakukan jika state mengizinkan. */
  transitionIfAllowed(next: ModuleState, reason?: string): boolean {
    if (!this.can(next)) return false;
    this.transition(next, reason);
    return true;
  }

  history(): readonly TransitionRecord[] {
    return [...this.records];
  }
}
