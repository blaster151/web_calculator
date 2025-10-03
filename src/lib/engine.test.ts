import { describe, expect, it } from "vitest";
import { evaluate } from "./engine";

describe("engine", () => {
  it("basic arithmetic", () => {
    expect(evaluate("2+3*4")).toBe(14);
    expect(evaluate("(2+3)*4")).toBe(20);
    expect(evaluate("2^8")).toBe(256);
  });
  it("percent and factorial", () => {
    expect(evaluate("50%")).toBe(0.5);
    expect(evaluate("5!")).toBe(120);
  });
  it("constants", () => {
    expect(evaluate("pi")).toBeCloseTo(Math.PI, 12);
    expect(evaluate("e")).toBeCloseTo(Math.E, 12);
  });
  it("functions DEG", () => {
    expect(evaluate("sin(30)","DEG")).toBeCloseTo(0.5, 10);
    expect(evaluate("cos(60)","DEG")).toBeCloseTo(0.5, 10);
  });
  it("functions RAD", () => {
    expect(evaluate("sin(pi/2)","RAD")).toBeCloseTo(1, 10);
  });
  it("errors", () => {
    expect(() => evaluate(")")).toThrow();
    expect(() => evaluate("(-)")).toThrow();
    expect(() => evaluate("-1!")).toThrow();
  });
});
