/** Canonical US phone: 11 digits (leading 1), stored/displayed as +1 (555) 123-4567 */
export const PHONE_FORMAT_EXAMPLE = "+1 (555) 123-4567";

export function getPhoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 10 && !digits.startsWith("1")) {
    digits = `1${digits}`;
  }
  return digits.slice(0, 11);
}

/** Format up to 11 digits for live input display or canonical storage. */
export function formatPhoneNumber(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";

  const area = d.slice(1, 4);
  const prefix = d.slice(4, 7);
  const line = d.slice(7, 11);

  let out = `+${d[0]}`;
  if (d.length === 1) return out;
  out += ` (${area}`;
  if (d.length <= 4) return out;
  out += `) ${prefix}`;
  if (d.length <= 7) return out;
  return `${out}-${line}`;
}

/** User typing: digits only (max 11), shown in canonical format. */
export function constrainPhoneInput(raw: string): string {
  return formatPhoneNumber(getPhoneDigits(raw));
}

/** Valid when exactly 11 digits with leading US country code 1. */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = getPhoneDigits(phone);
  return digits.length === 11 && digits.startsWith("1");
}

/** Normalize to canonical storage format; null if empty or invalid. */
export function normalizePhoneForStorage(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (!isValidPhoneNumber(trimmed)) return null;
  return formatPhoneNumber(getPhoneDigits(trimmed));
}

/** Map stored/legacy values into the phone input display format. */
export function phoneToInputDisplay(phone: string | null | undefined): string {
  if (!phone?.trim()) return "";
  let digits = getPhoneDigits(phone);
  if (digits.length === 10) digits = `1${digits}`;
  return digits ? formatPhoneNumber(digits) : "";
}

/** Read-only display; falls back to em dash when empty. */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const formatted = phoneToInputDisplay(phone);
  return formatted || "—";
}
