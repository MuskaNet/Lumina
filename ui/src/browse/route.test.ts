import { describe, expect, it } from "vitest";
import { BROWSE_PREFIX, browseHash, parseBrowseHash, searchHash } from "./route";

describe("browse hash routes", () => {
  it("keeps the legacy prefix", () => {
    expect(BROWSE_PREFIX).toBe("#browse/");
  });

  it("defaults to the welcome view", () => {
    expect(parseBrowseHash("#browse/welcome").view).toBe("welcome");
    expect(parseBrowseHash("").view).toBe("welcome");
    expect(parseBrowseHash("#browse/unknown-view").view).toBe("welcome");
  });

  it("parses the repository, path and query of a browse route", () => {
    const route = parseBrowseHash("#browse/browse:maven2-hosted:org/example/app.jar?source=npm");

    expect(route).toMatchObject({
      view: "browse",
      repo: "maven2-hosted",
      path: "org/example/app.jar",
    });
    expect(route.query.get("source")).toBe("npm");
  });

  it("parses the repository catalog route without a repository", () => {
    const route = parseBrowseHash("#browse/browse");

    expect(route).toMatchObject({ view: "browse", repo: "", path: "" });
  });

  it("keeps colons inside the repository path tail", () => {
    const route = parseBrowseHash("#browse/browse:repo:dir/a:b");

    expect(route.repo).toBe("repo");
    expect(route.path).toBe("dir/a:b");
  });

  it("decodes the repository name", () => {
    expect(parseBrowseHash("#browse/browse:my%20repo").repo).toBe("my repo");
  });

  it("parses the legacy search, upload and token views", () => {
    const search = parseBrowseHash("#browse/search?q=log4j&format=npm");
    expect(search.view).toBe("search");
    expect(search.query.get("q")).toBe("log4j");
    expect(search.query.get("format")).toBe("npm");

    expect(parseBrowseHash("#browse/upload").view).toBe("upload");
    expect(parseBrowseHash("#browse/my-token").view).toBe("my-token");
  });

  it("accepts hashes without the leading #", () => {
    expect(parseBrowseHash("browse/upload").view).toBe("upload");
  });
});

describe("browse hash writers", () => {
  it("writes the legacy repository route", () => {
    expect(browseHash("maven2-hosted")).toBe("#browse/browse:maven2-hosted");
    expect(browseHash("maven2-hosted", "org/example")).toBe("#browse/browse:maven2-hosted:org/example");
  });

  it("keeps the source query on repository links", () => {
    expect(browseHash("repo", "dir/file.txt", "npm team")).toBe(
      "#browse/browse:repo:dir/file.txt?source=npm%20team",
    );
  });

  it("writes the search route", () => {
    expect(searchHash("", "")).toBe("#browse/search");
    expect(searchHash("npm", "log4j")).toBe("#browse/search?format=npm&q=log4j");
  });
});
