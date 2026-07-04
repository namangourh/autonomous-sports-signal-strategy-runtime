import { describe, expect, it, vi } from "vitest";
import { createCircuitBreakerGate } from "./circuitBreakerGate.js";

describe("createCircuitBreakerGate", () => {
  it("does not trip while drawdown stays under the threshold", async () => {
    const onTrip = vi.fn().mockResolvedValue(undefined);
    const gate = createCircuitBreakerGate(2_000, onTrip); // 20% max drawdown

    await gate.recordSettlement(100_000_000); // establishes peak
    const tripped = await gate.recordSettlement(90_000_000); // 10% drawdown

    expect(tripped).toBe(false);
    expect(gate.isTripped()).toBe(false);
    expect(onTrip).not.toHaveBeenCalled();
  });

  it("trips exactly once when drawdown breaches the threshold, even across repeated settlements", async () => {
    const onTrip = vi.fn().mockResolvedValue(undefined);
    const gate = createCircuitBreakerGate(2_000, onTrip); // 20% max drawdown

    await gate.recordSettlement(100_000_000); // peak
    const firstBreach = await gate.recordSettlement(75_000_000); // 25% drawdown — breaches
    const secondCall = await gate.recordSettlement(70_000_000); // still tripped, deeper loss

    expect(firstBreach).toBe(true);
    expect(secondCall).toBe(true);
    expect(gate.isTripped()).toBe(true);
    expect(onTrip).toHaveBeenCalledTimes(1);
  });
});
