/**
 * Clipboard writes for the browse console. The asynchronous Clipboard API only
 * exists in secure contexts, while the console is commonly reached over plain
 * HTTP (reverse proxies, intranet hosts), so a legacy `execCommand` fallback is
 * kept for those deployments.
 */
export async function writeClipboard(text: string): Promise<void> {
  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy path when permissions block the Clipboard API.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  try {
    textarea.select();
    if (!document.execCommand?.("copy")) throw new Error("Copy command failed");
  } finally {
    textarea.remove();
  }
}
