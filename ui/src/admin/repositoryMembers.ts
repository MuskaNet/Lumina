/**
 * Group membership selection logic for the repository dialog.
 *
 * Mirrors the upstream console: candidates are repositories of the same format,
 * the group itself is excluded while editing, and nested groups are only allowed
 * for formats whose protocol defines group composition. The selected order is the
 * resolution priority (first match wins), so additions append and removals keep
 * the remaining order.
 */

export interface MemberCandidate {
  name: string;
  format?: string | null;
  type?: string | null;
}

/** Formats whose protocol allows a group repository to contain another group. */
export const NESTED_GROUP_FORMATS: readonly string[] = [
  "pub",
  "composer",
  "terraform",
  "swift",
  "ansiblegalaxy",
  "conda",
];

export function isNestedGroupFormat(format: string): boolean {
  return NESTED_GROUP_FORMATS.includes(format);
}

export function selectMemberCandidates<T extends MemberCandidate>(
  repositories: readonly T[],
  format: string,
  selfName = "",
): T[] {
  if (!format) return [];
  const allowNestedGroups = isNestedGroupFormat(format);
  return repositories.filter((repo) => {
    if (String(repo.format ?? "") !== format) return false;
    if (selfName && repo.name === selfName) return false;
    if (String(repo.type ?? "").toUpperCase() === "GROUP" && !allowNestedGroups) return false;
    return true;
  });
}

export function availableMembers<T extends MemberCandidate>(
  candidates: readonly T[],
  selected: readonly string[],
  filter = "",
): T[] {
  const selectedSet = new Set(selected);
  const needle = filter.trim().toLowerCase();
  return candidates.filter(
    (repo) => !selectedSet.has(repo.name)
      && (needle === "" || repo.name.toLowerCase().includes(needle)),
  );
}

export function addMemberNames(selected: readonly string[], names: readonly string[]): string[] {
  const next = [...selected];
  const existing = new Set(next);
  for (const name of names) {
    if (!existing.has(name)) {
      next.push(name);
      existing.add(name);
    }
  }
  return next;
}

export function removeMemberNames(selected: readonly string[], names: readonly string[]): string[] {
  const removed = new Set(names);
  return selected.filter((name) => !removed.has(name));
}

/** Moves a member up/down in the priority list, clamped to the list bounds. */
export function moveMember(selected: readonly string[], name: string, offset: number): string[] {
  const next = [...selected];
  const index = next.indexOf(name);
  if (index < 0 || offset === 0) return next;
  const target = Math.min(Math.max(index + offset, 0), next.length - 1);
  if (target === index) return next;
  next.splice(index, 1);
  next.splice(target, 0, name);
  return next;
}

/** Click behaviour for a transfer list: additive toggling or single selection. */
export function toggleMemberHighlight(
  highlight: readonly string[],
  name: string,
  additive: boolean,
): string[] {
  if (!additive) return [name];
  return highlight.includes(name)
    ? highlight.filter((value) => value !== name)
    : [...highlight, name];
}
