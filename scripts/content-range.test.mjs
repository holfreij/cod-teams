import { describe, it, expect } from "vitest";
import { parseContentRangeTotal } from "./content-range.mjs";

describe("parseContentRangeTotal", () => {
  it("parses 0-999/1234", () => {
    expect(parseContentRangeTotal("0-999/1234")).toBe(1234);
  });

  it("parses */0 (empty result)", () => {
    expect(parseContentRangeTotal("*/0")).toBe(0);
  });

  it("parses 0-11/12", () => {
    expect(parseContentRangeTotal("0-11/12")).toBe(12);
  });

  it("throws on null or missing header", () => {
    expect(() => parseContentRangeTotal(null)).toThrow("Content-Range header missing");
    expect(() => parseContentRangeTotal(undefined)).toThrow("Content-Range header missing");
  });

  it("throws on garbage/unparseable header", () => {
    expect(() => parseContentRangeTotal("abc")).toThrow("Content-Range header unparseable");
    expect(() => parseContentRangeTotal("0-999")).toThrow("Content-Range header unparseable");
    expect(() => parseContentRangeTotal("0-999/abc")).toThrow("Content-Range header unparseable");
  });
});
