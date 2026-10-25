import { describe, expect, it } from "vitest";
import {
  addMemberNames,
  availableMembers,
  isNestedGroupFormat,
  moveMember,
  removeMemberNames,
  selectMemberCandidates,
  toggleMemberHighlight,
} from "./repositoryMembers";

const repositories = [
  { name: "maven-hosted", format: "maven2", type: "HOSTED" },
  { name: "maven-proxy", format: "maven2", type: "PROXY" },
  { name: "maven-group", format: "maven2", type: "GROUP" },
  { name: "pub-member-group", format: "pub", type: "GROUP" },
  { name: "npm-hosted", format: "npm", type: "HOSTED" },
  { name: "self-group", format: "maven2", type: "GROUP" },
];

describe("group member candidates", () => {
  it("keeps the same format and hides the edited group itself", () => {
    const candidates = selectMemberCandidates(repositories, "maven2", "self-group");
    expect(candidates.map((repo) => repo.name)).toEqual(["maven-hosted", "maven-proxy"]);
  });

  it("only allows nested groups for protocols that support them", () => {
    expect(isNestedGroupFormat("pub")).toBe(true);
    expect(isNestedGroupFormat("maven2")).toBe(false);
    expect(selectMemberCandidates(repositories, "pub").map((repo) => repo.name)).toEqual([
      "pub-member-group",
    ]);
  });

  it("filters available members by name and drops already-selected ones", () => {
    const candidates = selectMemberCandidates(repositories, "maven2", "self-group");
    expect(availableMembers(candidates, ["maven-hosted"]).map((repo) => repo.name)).toEqual([
      "maven-proxy",
    ]);
    expect(availableMembers(candidates, [], "PROXY").map((repo) => repo.name)).toEqual([
      "maven-proxy",
    ]);
  });
});

describe("group member ordering", () => {
  it("appends new members once and preserves priority order", () => {
    expect(addMemberNames(["a"], ["b", "a", "c"])).toEqual(["a", "b", "c"]);
    expect(addMemberNames([], [])).toEqual([]);
  });

  it("removes members without disturbing the remaining order", () => {
    expect(removeMemberNames(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
    expect(removeMemberNames(["a"], [])).toEqual(["a"]);
  });

  it("moves a member up and down with clamped bounds", () => {
    expect(moveMember(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveMember(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveMember(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveMember(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });

  it("toggles single or additive highlight selections", () => {
    expect(toggleMemberHighlight(["a"], "b", false)).toEqual(["b"]);
    expect(toggleMemberHighlight(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleMemberHighlight(["a", "b"], "a", true)).toEqual(["b"]);
  });
});
