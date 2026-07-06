import { describe, it, expect } from "vitest";
import {
  constrainPhoneInput,
  formatPhoneDisplay,
  formatPhoneNumber,
  getPhoneDigits,
  isValidPhoneNumber,
  normalizePhoneForStorage,
  phoneToInputDisplay,
} from "../../supabase/functions/_shared/phone-validation";

describe("phone validation", () => {
  it("formats 11 digits as +1 (555) 123-4567", () => {
    expect(formatPhoneNumber("15551234567")).toBe("+1 (555) 123-4567");
    expect(normalizePhoneForStorage("15551234567")).toBe("+1 (555) 123-4567");
    expect(normalizePhoneForStorage("+1 (555) 123-4567")).toBe("+1 (555) 123-4567");
  });

  it("accepts only 11-digit numbers with leading country code 1", () => {
    expect(isValidPhoneNumber("+1 (555) 123-4567")).toBe(true);
    expect(isValidPhoneNumber("15551234567")).toBe(true);
    expect(isValidPhoneNumber("(555) 123-4567")).toBe(true);
    expect(isValidPhoneNumber("555-1234")).toBe(false);
    expect(isValidPhoneNumber("55512345678")).toBe(false);
  });

  it("limits input to 11 digits and formats while typing", () => {
    expect(getPhoneDigits(constrainPhoneInput("1555123456789012"))).toHaveLength(11);
    expect(constrainPhoneInput("1555123")).toBe("+1 (555) 123");
    expect(constrainPhoneInput("(555) 123-4567abc")).toBe("+1 (555) 123-4567");
  });

  it("normalizes legacy 10-digit values for display", () => {
    expect(phoneToInputDisplay("(555) 123-4567")).toBe("+1 (555) 123-4567");
    expect(formatPhoneDisplay(null)).toBe("—");
  });
});
