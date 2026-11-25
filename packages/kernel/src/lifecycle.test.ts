import { describe, expect, it } from "vitest";
import { LifecycleMachine } from "./lifecycle";

describe("state machine lifecycle modul", () => {
  it("mengikuti urutan lifecycle yang sah", () => {
    const machine = new LifecycleMachine("aether.uji");
    const states = [
      "VALIDATING",
      "RESOLVING",
      "REGISTERING",
      "INITIALIZING",
      "STARTING",
      "READY",
      "STOPPING",
      "STOPPED",
    ] as const;

    for (const state of states) machine.transition(state);
    expect(machine.state).toBe("STOPPED");
    expect(machine.history()).toHaveLength(states.length);
  });

  it("menolak transisi ilegal", () => {
    const machine = new LifecycleMachine("aether.uji");
    expect(() => machine.transition("READY")).toThrow(/tidak diizinkan/);
    expect(machine.state).toBe("DISCOVERED");
  });

  it("mencatat alasan transisi", () => {
    const machine = new LifecycleMachine("aether.uji");
    machine.transition("VALIDATING", "startup");
    expect(machine.history()[0]?.reason).toBe("startup");
  });

  it("transisiIfAllowed tidak melempar saat tidak diizinkan", () => {
    const machine = new LifecycleMachine("aether.uji");
    expect(machine.transitionIfAllowed("STOPPED")).toBe(false);
    expect(machine.state).toBe("DISCOVERED");
  });

  it("mengizinkan cleanup dari state gagal", () => {
    const machine = new LifecycleMachine("aether.uji");
    machine.transition("VALIDATING");
    machine.transition("VALIDATION_FAILED");
    expect(machine.transitionIfAllowed("STOPPING", "rollback")).toBe(true);
    expect(machine.transitionIfAllowed("STOPPED", "rollback")).toBe(true);
  });

  it("state terminal tidak memiliki transisi lanjutan", () => {
    const machine = new LifecycleMachine("aether.uji");
    for (const state of ["VALIDATING", "RESOLVING", "REGISTERING", "INITIALIZING", "STARTING", "READY", "STOPPING", "STOPPED"] as const) {
      machine.transition(state);
    }
    expect(machine.can("STARTING")).toBe(false);
    expect(machine.transitionIfAllowed("READY")).toBe(false);
  });
});
