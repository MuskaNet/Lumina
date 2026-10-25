import { ref } from "vue";
import { api } from "./api/client";

export interface SessionInfo {
  source?: string | null;
  userId?: string | null;
  realmId?: string | null;
  apiKeyId?: number | null;
  roles?: string[] | null;
}

export interface AdminBootstrapStatus {
  required: boolean;
  source?: string | null;
  userId?: string | null;
  roleId?: string | null;
  minPasswordLength: number;
  anonymousAccessEnabled: boolean;
}

export interface SecurityContext {
  bootstrap: AdminBootstrapStatus;
  session: SessionInfo | null;
  permissions: string[];
}

export const session = ref<SessionInfo | null>(null);
export const permissions = ref<string[]>([]);
export const bootstrap = ref<AdminBootstrapStatus | null>(null);

export async function loadSecurityContext(): Promise<SecurityContext | null> {
  const context = await api.getOrNull<SecurityContext>("/internal/security/context");
  if (!context) return null;
  bootstrap.value = context.bootstrap;
  session.value = context.session ?? null;
  permissions.value = Array.isArray(context.permissions) ? context.permissions : [];
  return context;
}

export function can(permission: string): boolean {
  return permissions.value.includes(permission);
}

export function qualifiedUser(): string {
  const current = session.value;
  if (!current?.userId) return "";
  return current.source ? `${current.source}/${current.userId}` : current.userId;
}

export function signOut(returnTo = "/browse/#browse/welcome"): void {
  globalThis.location?.assign(`/internal/security/logout?returnTo=${encodeURIComponent(returnTo)}`);
}
