import { describe, expect, it } from "vitest";
import { createCorrelationId, createExecutionId, createId, createRequestId } from "./index";

describe("pembangkit identifier", () => {
  it("menghasilkan identifier dengan prefix yang benar", () => {
    expect(createRequestId()).toMatch(/^req_[0-9a-z]+$/);
    expect(createCorrelationId()).toMatch(/^corr_[0-9a-z]+$/);
    expect(createExecutionId()).toMatch(/^exec_[0-9a-z]+$/);
    expect(createId("Skill Uji")).toMatch(/^skilluji_[0-9a-z]+$/);
  });

  it("menghasilkan identifier unik", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createRequestId()));
    expect(ids.size).toBe(1000);
  });
});
