const CSRF_COOKIE = "KKREPO_CSRF";
const CSRF_HEADER = "X-Nexus-Plus-CSRF-Token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function authRequiredLocation(returnTo?: string): string {
  const params = new URLSearchParams({ login: "1" });
  const target = safeReturnTo(returnTo);
  if (target) params.set("returnTo", target);
  return `/browse/?${params.toString()}#browse/welcome`;
}

/** Only same-origin absolute paths may be used as a post-login return target. */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(CSRF_COOKIE.length + 1)) : "";
}

export async function responseErrorMessage(response: Response): Promise<string> {
  if (response.status === 401 || response.status === 403) return "Authentication required.";
  try {
    const text = await response.text();
    if (!text) return `HTTP ${response.status}`;
    try {
      const payload = JSON.parse(text) as { message?: string; error?: string };
      return payload.message || payload.error || text.trim() || `HTTP ${response.status}`;
    } catch {
      return text.trim() || `HTTP ${response.status}`;
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Redirects to the sign-in page on 401/403 instead of throwing. */
  redirectOnAuthFailure?: boolean;
}

async function sendRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers ?? {});
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    if (options.body instanceof FormData || options.body instanceof Blob) {
      body = options.body;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }
  }
  if (!SAFE_METHODS.has(method)) {
    const token = csrfToken();
    if (token) headers.set(CSRF_HEADER, token);
  }

  const response = await fetch(path, {
    method,
    headers,
    body,
    signal: options.signal,
    cache: SAFE_METHODS.has(method) ? "no-store" : undefined,
    credentials: "same-origin",
  });

  if (!response.ok) {
    if (options.redirectOnAuthFailure !== false && (response.status === 401 || response.status === 403)) {
      globalThis.location?.assign(authRequiredLocation(currentReturnTo()));
      throw new ApiError(response.status, "Authentication required.");
    }
    throw new ApiError(response.status, await responseErrorMessage(response));
  }
  return response;
}

export function currentReturnTo(): string {
  if (typeof location === "undefined") return "";
  return `${location.pathname}${location.search}${location.hash}`;
}

export const api = {
  async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return (await sendRequest(path, { signal })).json() as Promise<T>;
  },
  async getOrNull<T>(path: string, signal?: AbortSignal): Promise<T | null> {
    try {
      return (await sendRequest(path, { signal })).json() as Promise<T>;
    } catch {
      return null;
    }
  },
  async send<T>(path: string, method: string, body?: unknown, signal?: AbortSignal): Promise<T | null> {
    const response = await sendRequest(path, { method, body, signal });
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : null;
  },
  delete(path: string, signal?: AbortSignal): Promise<null> {
    return api.send<null>(path, "DELETE", undefined, signal);
  },
};
