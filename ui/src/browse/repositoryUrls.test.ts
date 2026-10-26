import { describe, expect, it } from "vitest";
import { dockerRepositoryBaseUrl, repositoryClientUrl } from "./repositoryUrls";

const LOCATION = {
  origin: "https://repo.example.com",
  protocol: "https:",
  hostname: "repo.example.com",
};

describe("dockerRepositoryBaseUrl", () => {
  it("prefers the configured connector public URL without a trailing slash", () => {
    expect(
      dockerRepositoryBaseUrl(
        { name: "docker-hosted", docker: { connectorEnabled: true, connectorPublicUrl: "https://hub.example.com/" } },
        LOCATION,
      ),
    ).toBe("https://hub.example.com");
  });

  it("falls back to the connector port on the current host", () => {
    expect(
      dockerRepositoryBaseUrl(
        { name: "docker-hosted", docker: { connectorEnabled: true, connectorPort: 5000 } },
        LOCATION,
      ),
    ).toBe("https://repo.example.com:5000");
  });

  it("falls back to the shared /v2 registry path when the connector is disabled", () => {
    expect(
      dockerRepositoryBaseUrl({ name: "docker proxy", docker: { connectorEnabled: false } }, LOCATION),
    ).toBe("https://repo.example.com/v2/docker%20proxy");
  });

  it("keeps the relative /v2 path when no location is available", () => {
    expect(dockerRepositoryBaseUrl({ name: "docker-hosted" }, null)).toBe("/v2/docker-hosted");
  });
});

describe("repositoryClientUrl", () => {
  it("returns the absolute Nexus-compatible repository URL", () => {
    expect(
      repositoryClientUrl(
        { name: "maven-hosted", format: "maven2", url: "/repository/maven-hosted/" },
        LOCATION,
      ),
    ).toBe("https://repo.example.com/repository/maven-hosted/");
  });

  it("derives the default /repository/<name>/ path when the payload omits url", () => {
    expect(repositoryClientUrl({ name: "raw repo", format: "raw" }, LOCATION)).toBe(
      "https://repo.example.com/repository/raw%20repo/",
    );
  });

  it("uses the Docker connector endpoint for Docker repositories", () => {
    expect(
      repositoryClientUrl(
        {
          name: "docker-hosted",
          format: "DOCKER",
          docker: { connectorEnabled: true, connectorPublicUrl: "https://hub.example.com/" },
        },
        LOCATION,
      ),
    ).toBe("https://hub.example.com");
  });

  it("keeps the relative path when no location is available", () => {
    expect(repositoryClientUrl({ name: "maven-hosted", format: "maven2" }, null)).toBe(
      "/repository/maven-hosted/",
    );
  });
});
