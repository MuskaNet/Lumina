/**
 * Cleanup policy draft, candidate filtering and payload construction.
 *
 * Mirrors the upstream console:
 * - only repositories of the policy format that are Hosted or Proxy can be targets
 *   (groups never own cleanable content, the server rejects them);
 * - rules are GLOB/REGEX pattern plus optional published/downloaded ages and an
 *   optional "keep newest versions" count, and at least one age/retain rule is
 *   required (a pattern only narrows the scope);
 * - the dialog keeps the stored scan/delete limits and schedule enablement.
 */
import { recipeDisplayName } from "./repositoryRecipes";

export interface CleanupCapability {
  format: string;
  tryRunSupported?: boolean;
  retainCountSupported?: boolean;
  lastDownloadedSupported?: boolean;
  executeSupported?: boolean;
}

export interface CleanupFormatOption {
  value: string;
  label: string;
  disabled: boolean;
  capability?: CleanupCapability;
}

export interface CleanupRepositoryLike {
  id?: number | null;
  name: string;
  format?: string | null;
  type?: string | null;
  online?: boolean;
}

export interface CleanupTargetLike {
  id?: number | null;
  name?: string;
  format?: string | null;
  type?: string | null;
  online?: boolean;
}

export interface CleanupPolicyViewLike {
  policy?: {
    id?: number;
    name?: string;
    format?: string;
    notes?: string | null;
    revision?: number;
    criteria?: Record<string, unknown> | null;
    scanLimitPerRepository?: number | null;
    deleteLimitPerRepository?: number | null;
  } | null;
  repositories?: CleanupTargetLike[] | null;
  schedule?: { cronExpression?: string | null; timeZone?: string | null; enabled?: boolean } | null;
  capability?: CleanupCapability | null;
}

export interface CleanupPolicyDraft {
  name: string;
  format: string;
  notes: string;
  patternType: string;
  pattern: string;
  publishedOlderThanDays: number | string | null;
  lastDownloadedOlderThanDays: number | string | null;
  retainCount: number | string | null;
  repositoryIds: number[];
  cronExpression: string;
  timeZone: string;
}

const TARGET_TYPES = new Set(["hosted", "proxy"]);

function lower(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function cleanupFormatLabel(format: string): string {
  return recipeDisplayName(format);
}

/** Format list comes from the server capability matrix (all RepositoryFormat values). */
export function buildCleanupFormatOptions(
  capabilities: readonly CleanupCapability[],
  fallbackFormats: readonly string[] = [],
): CleanupFormatOption[] {
  const source = capabilities.length
    ? capabilities.map((capability) => ({ format: lower(capability.format), capability }))
    : [...new Set(fallbackFormats.map(lower).filter(Boolean))].map((format) => ({ format, capability: undefined }));
  return source.map(({ format, capability }) => ({
    value: format,
    label: cleanupFormatLabel(format),
    disabled: capability?.executeSupported === false,
    capability,
  }));
}

/** Hosted/proxy repositories of the policy format, sorted by name (upstream rule). */
export function cleanupRepositoryCandidates(
  repositories: readonly CleanupRepositoryLike[],
  format: string,
): CleanupRepositoryLike[] {
  const expected = lower(format);
  if (!expected) return [];
  return repositories
    .filter((repository) => lower(repository.format) === expected
      && TARGET_TYPES.has(lower(repository.type)))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function filterCleanupRepositories(
  candidates: readonly CleanupRepositoryLike[],
  query: string,
): CleanupRepositoryLike[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...candidates];
  return candidates.filter((repository) =>
    `${repository.name} ${lower(repository.type)} ${repository.online === false ? "offline" : "online"}`
      .toLowerCase()
      .includes(needle),
  );
}

export function pruneCleanupRepositoryIds(
  selected: readonly number[],
  candidates: readonly CleanupRepositoryLike[],
): number[] {
  const allowed = new Set(candidates.map((repository) => Number(repository.id)));
  return selected.filter((id) => allowed.has(id));
}

export function createCleanupPolicyDraft(format = "", timeZone = "UTC"): CleanupPolicyDraft {
  return {
    name: "",
    format,
    notes: "",
    patternType: "GLOB",
    pattern: "",
    publishedOlderThanDays: null,
    lastDownloadedOlderThanDays: null,
    retainCount: null,
    repositoryIds: [],
    cronExpression: "",
    timeZone,
  };
}

export function cleanupPolicyDraftFromView(view: CleanupPolicyViewLike): CleanupPolicyDraft {
  const policy = view.policy ?? {};
  const criteria = (policy.criteria ?? {}) as Record<string, unknown>;
  return {
    name: policy.name ?? "",
    format: lower(policy.format),
    notes: policy.notes ?? "",
    patternType: String(criteria.patternType ?? "GLOB").toUpperCase(),
    pattern: String(criteria.pattern ?? ""),
    publishedOlderThanDays: numberOrNull(criteria.publishedOlderThanDays),
    lastDownloadedOlderThanDays: numberOrNull(criteria.lastDownloadedOlderThanDays),
    retainCount: numberOrNull(criteria.retainCount),
    repositoryIds: (view.repositories ?? [])
      .map((repository) => Number(repository.id))
      .filter((id) => Number.isFinite(id)),
    cronExpression: view.schedule?.cronExpression ?? "",
    timeZone: view.schedule?.timeZone ?? "UTC",
  };
}

export function buildCleanupCriteria(draft: CleanupPolicyDraft): Record<string, unknown> {
  const criteria: Record<string, unknown> = {};
  const pattern = draft.pattern.trim();
  if (pattern) {
    criteria.pattern = pattern;
    criteria.patternType = draft.patternType || "GLOB";
  }
  const published = numberOrNull(draft.publishedOlderThanDays);
  if (published != null) criteria.publishedOlderThanDays = published;
  const downloaded = numberOrNull(draft.lastDownloadedOlderThanDays);
  if (downloaded != null) criteria.lastDownloadedOlderThanDays = downloaded;
  const retain = numberOrNull(draft.retainCount);
  if (retain != null) criteria.retainCount = retain;
  return criteria;
}

export interface CleanupExistingSettings {
  revision?: number | null;
  scanLimitPerRepository?: number | null;
  deleteLimitPerRepository?: number | null;
  scheduleEnabled?: boolean;
}

export function buildCleanupPolicyPayload(
  draft: CleanupPolicyDraft,
  existing: CleanupExistingSettings = {},
): Record<string, unknown> {
  const cronExpression = draft.cronExpression.trim();
  return {
    name: draft.name.trim(),
    format: draft.format,
    notes: draft.notes.trim() || null,
    criteria: buildCleanupCriteria(draft),
    repositoryIds: [...draft.repositoryIds],
    scanLimitPerRepository: existing.scanLimitPerRepository ?? null,
    deleteLimitPerRepository: existing.deleteLimitPerRepository ?? null,
    schedule: cronExpression
      ? {
        cronExpression,
        timeZone: draft.timeZone || "UTC",
        enabled: Boolean(existing.scheduleEnabled),
      }
      : null,
    revision: existing.revision ?? null,
  };
}

export interface CleanupPolicyValidation {
  name: boolean;
  repositories: boolean;
  criteria: boolean;
}

export function validateCleanupPolicyDraft(draft: CleanupPolicyDraft): CleanupPolicyValidation {
  const criteria = buildCleanupCriteria(draft);
  const hasRule = criteria.publishedOlderThanDays != null
    || criteria.lastDownloadedOlderThanDays != null
    || criteria.retainCount != null;
  return {
    name: draft.name.trim().length === 0,
    repositories: draft.repositoryIds.length === 0,
    criteria: !hasRule,
  };
}
