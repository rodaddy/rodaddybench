import { describe, test, expect } from "bun:test";
import { parseCompareArgs } from "../../src/cli/compare.ts";

describe("parseCompareArgs", () => {
  test("parses two positional refs", () => {
    const opts = parseCompareArgs(["latest", "previous"]);
    expect(opts.ref1).toBe("latest");
    expect(opts.ref2).toBe("previous");
    expect(opts.threshold).toBe(0.1);
  });

  test("parses --threshold flag correctly", () => {
    const opts = parseCompareArgs([
      "latest",
      "previous",
      "--threshold",
      "0.05",
    ]);
    expect(opts.threshold).toBe(0.05);
  });

  test("parses --model and --category filters", () => {
    const opts = parseCompareArgs([
      "latest",
      "previous",
      "-m",
      "claude-sonnet",
      "-c",
      "infra",
    ]);
    expect(opts.models).toEqual(["claude-sonnet"]);
    expect(opts.categories).toEqual(["infra"]);
  });

  test("errors on missing run refs (fewer than 2 positionals)", () => {
    expect(() => parseCompareArgs(["latest"])).toThrow(
      "Compare requires two run references",
    );
    expect(() => parseCompareArgs([])).toThrow(
      "Compare requires two run references",
    );
  });
});
