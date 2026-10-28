/** Write text to the browser clipboard. Callers decide how to report failures. */
export async function writeClipboard(text: string): Promise<void> {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) throw new Error("Clipboard API unavailable");
  await clipboard.writeText(text);
}
