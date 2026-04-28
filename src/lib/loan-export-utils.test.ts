import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "@/lib/loan-export-utils";

describe("escapeCsvCell", () => {
  it("wraps simple text in quotes", () => {
    expect(escapeCsvCell("hello")).toBe('"hello"');
  });

  it("escapes embedded double quotes", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("handles null and undefined as empty", () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });

  it("stringifies numbers", () => {
    expect(escapeCsvCell(42)).toBe('"42"');
  });
});
