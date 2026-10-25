import { describe, expect, it } from "vitest";
import {
  buildCleanupCriteria,
  buildCleanupFormatOptions,
  buildCleanupPolicyPayload,
  cleanupPolicyDraftFromView,
  cleanupRepositoryCandidates,
  createCleanupPolicyDraft,
  filterCleanupRepositories,
  pruneCleanupRepositoryIds,
  validateCleanupPolicyDraft,
} from "./cleanupPolicy";

const capabilities = [
  { format: "maven2", tryRunSupported: true, retainCountSupported: true, lastDownloadedSupported: true, executeSupported: true },
  { format: "npm", tryRunSupported: true, retainCountSupported: false, lastDownloadedSupported: true, executeSupported: true },
  { format: "gitlfs", tryRunSupported: false, retainCountSupported: false, lastDownloadedSupported: false, executeSupported: false },
];

const repositories = [
  { id: 1, name: "maven-hosted", format: "maven2", type: "HOSTED", online: true },
  { id: 2, name: "maven-proxy", format: "maven2", type: "PROXY", online: false },
  { id: 3, name: "maven-group", format: "maven2", type: "GROUP", online: true },
  { id: 4, name: "npm-hosted", format: "npm", type: "HOSTED", online: true },
];

describe("cleanup format options", () => {
  it("uses the server capability order and human format names", () => {
    const options = buildCleanupFormatOptions(capabilities);
    expect(options.map((option) => option.label)).toEqual(["Maven", "npm", "Git LFS"]);
    expect(options[0]!.capability?.retainCountSupported).toBe(true);
    expect(options[2]!.disabled).toBe(true);
  });
});

describe("cleanup target repository filtering", () => {
  it("keeps only hosted/proxy repositories of the selected format, sorted by name", () => {
    const candidates = cleanupRepositoryCandidates(repositories, "maven2");
    expect(candidates.map((repository) => repository.name)).toEqual(["maven-hosted", "maven-proxy"]);
    expect(cleanupRepositoryCandidates(repositories, "npm").map((r) => r.name)).toEqual(["npm-hosted"]);
    expect(cleanupRepositoryCandidates(repositories, "")).toEqual([]);
  });

  it("filters candidates by name, type and online state", () => {
    const candidates = cleanupRepositoryCandidates(repositories, "maven2");
    expect(filterCleanupRepositories(candidates, "proxy").map((r) => r.id)).toEqual([2]);
    expect(filterCleanupRepositories(candidates, "offline").map((r) => r.id)).toEqual([2]);
    expect(filterCleanupRepositories(candidates, "HOSTED").map((r) => r.id)).toEqual([1]);
  });

  it("prunes selections that no longer match the format", () => {
    const candidates = cleanupRepositoryCandidates(repositories, "npm");
    expect(pruneCleanupRepositoryIds([1, 4], candidates)).toEqual([4]);
  });
});

describe("cleanup criteria and payload", () => {
  it("requires at least one age or retain rule; a pattern only narrows scope", () => {
    const draft = createCleanupPolicyDraft("maven2");
    draft.pattern = "jackson-*";
    expect(buildCleanupCriteria(draft)).toEqual({ pattern: "jackson-*", patternType: "GLOB" });
    expect(validateCleanupPolicyDraft(draft).criteria).toBe(true);

    draft.publishedOlderThanDays = 30;
    expect(buildCleanupCriteria(draft)).toEqual({
      pattern: "jackson-*",
      patternType: "GLOB",
      publishedOlderThanDays: 30,
    });
    expect(validateCleanupPolicyDraft(draft).criteria).toBe(false);
  });

  it("preserves the stored scan/delete limits and schedule enablement", () => {
    const draft = createCleanupPolicyDraft("maven2", "Asia/Shanghai");
    draft.name = "Clean old";
    draft.repositoryIds = [1, 2];
    draft.retainCount = 5;
    draft.cronExpression = "0 0 2 * * ?";

    const payload = buildCleanupPolicyPayload(draft, {
      revision: 7,
      scanLimitPerRepository: 250,
      deleteLimitPerRepository: 50,
      scheduleEnabled: true,
    });

    expect(payload).toMatchObject({
      name: "Clean old",
      format: "maven2",
      repositoryIds: [1, 2],
      scanLimitPerRepository: 250,
      deleteLimitPerRepository: 50,
      revision: 7,
      criteria: { retainCount: 5 },
      schedule: { cronExpression: "0 0 2 * * ?", timeZone: "Asia/Shanghai", enabled: true },
    });
  });

  it("sends a null schedule when no cron expression is configured", () => {
    const draft = createCleanupPolicyDraft("npm");
    draft.name = "npm cleanup";
    draft.repositoryIds = [4];
    draft.lastDownloadedOlderThanDays = 90;
    const payload = buildCleanupPolicyPayload(draft);
    expect(payload.schedule).toBeNull();
    expect(payload.revision).toBeNull();
    expect(payload.criteria).toEqual({ lastDownloadedOlderThanDays: 90 });
  });

  it("rebuilds the draft from an existing policy view", () => {
    const draft = cleanupPolicyDraftFromView({
      policy: {
        id: 9,
        name: "Old",
        format: "maven2",
        notes: "note",
        revision: 3,
        criteria: { pattern: "a-*", patternType: "REGEX", retainCount: 2 },
      },
      repositories: [
        { id: 1, name: "maven-hosted" },
        { id: 2, name: "maven-proxy" },
      ],
      schedule: { cronExpression: "0 0 2 * * ?", timeZone: "UTC", enabled: true },
    });
    expect(draft).toMatchObject({
      name: "Old",
      format: "maven2",
      notes: "note",
      patternType: "REGEX",
      pattern: "a-*",
      retainCount: 2,
      repositoryIds: [1, 2],
      cronExpression: "0 0 2 * * ?",
      timeZone: "UTC",
    });
  });
});
