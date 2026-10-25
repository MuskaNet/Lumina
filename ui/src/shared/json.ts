/** Parses a JSON object from a textarea; returns undefined when the text is empty. */
export function parseJsonObject(value: string): Record<string, unknown> | undefined {
  const text = value.trim();
  if (!text) return undefined;
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

/** Renders an object as pretty JSON for editing. */
export function formatJsonObject(value: unknown): string {
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
}
