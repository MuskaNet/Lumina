import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MediaStub {
  listeners: ((event: MediaQueryListEvent) => void)[];
  set: (matches: boolean) => void;
}

function installMatchMedia(initial: boolean): MediaStub {
  const listeners: ((event: MediaQueryListEvent) => void)[] = [];
  const query = {
    matches: initial,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === "change") listeners.push(listener);
    },
    removeEventListener: () => {},
    addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.push(listener),
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", (media: string) => {
    expect(media).toBe("(prefers-color-scheme: dark)");
    return query;
  });
  return {
    listeners,
    set: (matches: boolean) => {
      (query as { matches: boolean }).matches = matches;
      for (const listener of listeners) listener({ matches } as MediaQueryListEvent);
    },
  };
}

async function loadTheme() {
  vi.resetModules();
  return import("./index");
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.body.className = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.className = "";
  document.body.className = "";
});

describe("theme colour scheme", () => {
  it("applies the dark scheme when the OS prefers dark", async () => {
    installMatchMedia(true);
    const theme = await loadTheme();

    expect(theme.systemColorScheme()).toBe("dark");
    theme.initTheme();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.body.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("default");
  });

  it("applies the light scheme when the OS prefers light", async () => {
    installMatchMedia(false);
    const theme = await loadTheme();

    expect(theme.systemColorScheme()).toBe("light");
    theme.initTheme();

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.body.classList.contains("light")).toBe(true);
  });

  it("re-applies the scheme when the OS appearance changes", async () => {
    const media = installMatchMedia(false);
    const theme = await loadTheme();
    theme.initTheme();
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(media.listeners).toHaveLength(1);

    media.set(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);

    media.set(false);
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("falls back to the light scheme without matchMedia", async () => {
    vi.stubGlobal("matchMedia", undefined);
    const theme = await loadTheme();

    expect(theme.systemColorScheme()).toBeNull();
    theme.initTheme();

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
