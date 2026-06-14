/**
 * Guards the branch-page → brain link. Every signupIndustry value emitted by a
 * branded vertical page MUST be a valid industry AND map to a bundled schema
 * pack, or a signup from that page silently loses its vertical configuration.
 */
import { describe, test, expect } from "bun:test";
import { INDUSTRY_PACK, INDUSTRIES, isValidIndustry, packForIndustry } from "./industry-pack";

// The signupIndustry values wired in the marketing wrappers + product config.
const BRANCH_SIGNUP_INDUSTRIES = [
  "legal", "tax", "compliance", "insurance", "realestate", "vc", "consulting", "recruiting",
];

describe("industry-pack", () => {
  test("every branch signupIndustry is accepted and maps to a pack", () => {
    for (const ind of BRANCH_SIGNUP_INDUSTRIES) {
      expect(isValidIndustry(ind)).toBe(true);
      expect(packForIndustry(ind)).toMatch(/^gbrain-/);
    }
  });

  test("compliance and realestate are accepted (regression: were dropped)", () => {
    expect(isValidIndustry("compliance")).toBe(true);
    expect(isValidIndustry("realestate")).toBe(true);
    expect(packForIndustry("compliance")).toBe("gbrain-compliance");
    expect(packForIndustry("realestate")).toBe("gbrain-realestate");
  });

  test("vc maps to the investor pack", () => {
    expect(packForIndustry("vc")).toBe("gbrain-investor");
  });

  test("'other' is valid but has no vertical pack", () => {
    expect(isValidIndustry("other")).toBe(true);
    expect(packForIndustry("other")).toBeNull();
  });

  test("unknown / empty → invalid, null pack", () => {
    expect(isValidIndustry("banking")).toBe(false);
    expect(isValidIndustry(null)).toBe(false);
    expect(isValidIndustry(undefined)).toBe(false);
    expect(packForIndustry(null)).toBeNull();
    expect(packForIndustry("banking")).toBeNull();
  });

  test("INDUSTRIES = mapped verticals + 'other'", () => {
    expect(INDUSTRIES.size).toBe(Object.keys(INDUSTRY_PACK).length + 1);
    expect(INDUSTRIES.has("other")).toBe(true);
  });
});
