export const INVENTORY_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"] as const;

/**
 * Reads an inventory counter from a usage snapshot.
 *
 * Counters arrive as decimal strings (they can exceed Number.MAX_SAFE_INTEGER),
 * so anything that is not an exact non-negative integer is reported as unknown.
 */
export function inventoryValue(
  snapshot: InventorySnapshot | null | undefined,
  id: string | number,
  key: string,
): bigint | null {
  const value = snapshot?.usage?.[String(id)]?.[key];
  if (typeof value === "bigint") return value >= 0n ? value : null;
  if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) return BigInt(value);
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
}

export interface InventorySnapshot {
  usage?: Record<string, Record<string, unknown>>;
  calculatedAt?: string;
}

/** Formats a byte count with integer-only rounding, safe above Number.MAX_SAFE_INTEGER. */
export function formatInventoryBytes(value: bigint | number, locale?: string): string {
  const bytes = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  let unit = 0;
  let divisor = 1n;
  while (bytes >= divisor * 1024n && unit < INVENTORY_UNITS.length - 1) {
    divisor *= 1024n;
    unit += 1;
  }
  if (unit === 0) return `${bytes.toLocaleString(locale)} B`;

  const tenths = (bytes * 10n + divisor / 2n) / divisor;
  const whole = tenths / 10n;
  const fraction = tenths % 10n;
  const formatted = fraction === 0n
    ? whole.toLocaleString(locale)
    : new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        .formatToParts(whole)
        .map((part) => (part.type === "fraction" ? fraction.toLocaleString(locale) : part.value))
        .join("");
  return `${formatted} ${INVENTORY_UNITS[unit]}`;
}
