package com.github.klboke.kkrepo.admin.ui;

import static com.github.klboke.kkrepo.admin.ui.UiSources.resource;
import static com.github.klboke.kkrepo.admin.ui.UiSources.resourceExists;
import static com.github.klboke.kkrepo.admin.ui.UiSources.ui;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Guards the admin console entry point served by Spring Boot.
 *
 * <p>The console is a built Vue bundle produced by {@code ui/}; these assertions pin the pieces
 * that the server, the CSP, and existing deep links depend on.
 */
class AdminUiEntryPointContractTest {

  @Test
  void entryPointLoadsTheBundledApplication() throws IOException {
    String index = resource("/META-INF/resources/admin/index.html");

    assertTrue(index.contains("src=\"/admin/assets/app.js\""), "admin bundle script");
    assertTrue(index.contains("href=\"/admin/assets/app.css\""), "admin bundle stylesheet");
    assertTrue(index.contains("<div id=\"app\"></div>"), "Vue mount point");
  }

  @Test
  void entryPointKeepsMavenVersionFiltering() throws IOException {
    String index = resource("/META-INF/resources/admin/index.html");

    // maven-resources-plugin filters this document, so the packaged copy carries the
    // resolved version and must no longer contain the raw placeholder.
    assertTrue(index.contains("<meta name=\"kkrepo-version\" content=\""), "version meta tag");
    assertFalse(index.contains("@project.version@"), "unfiltered Maven placeholder");
  }

  @Test
  void entryPointStaysCompatibleWithTheSelfOnlyContentSecurityPolicy() throws IOException {
    String index = resource("/META-INF/resources/admin/index.html");

    // script-src 'self' forbids inline scripts and eval-based template compilation.
    assertFalse(index.contains("<script>"), "inline script");
    assertFalse(index.contains("javascript:"), "javascript: URL");
    assertFalse(index.toLowerCase().contains("unsafe-eval"), "unsafe-eval directive");
  }

  @Test
  void bundledAssetsArePresent() {
    assertTrue(resourceExists("/META-INF/resources/admin/assets/app.js"), "app.js");
    assertTrue(resourceExists("/META-INF/resources/admin/assets/app.css"), "app.css");
    assertTrue(
        resourceExists("/META-INF/resources/admin/assets/material-symbols.woff2"),
        "self-hosted Material Symbols font");
  }

  @Test
  void legacyAdministrationBundlesAreGone() {
    assertFalse(resourceExists("/META-INF/resources/admin/assets/admin.js"), "legacy admin.js");
    assertFalse(resourceExists("/META-INF/resources/admin/assets/admin.css"), "legacy admin.css");
    assertFalse(
        resourceExists("/META-INF/resources/admin/assets/content-selectors.js"),
        "legacy content-selectors.js");
  }

  @Test
  void administrationNavigationKeepsEveryLegacyHashRoute() throws IOException {
    String nav = ui("src/admin/nav.ts");

    String[] expected = {
        "#admin/repository/repositories",
        "#admin/repository/cleanup-policies",
        "#admin/repository/content-selectors",
        "#admin/repository/blobstores",
        "#admin/repository/docker",
        "#admin/security/users",
        "#admin/security/roles",
        "#admin/security/privileges",
        "#admin/security/realms",
        "#admin/security/ldap",
        "#admin/security/oidc",
        "#admin/security/anonymous",
        "#admin/security/api-keys",
        "#admin/security/artifact-scanning",
        "#admin/security/audit-log",
        "#admin/system/ui-settings",
        "#admin/migration/nexus",
        "#admin/migration/repository-data",
    };
    for (String route : expected) {
      assertTrue(nav.contains("\"" + route + "\""), route);
    }
  }

  @Test
  void legacyHashAliasesStillResolve() throws IOException {
    String router = ui("src/admin/router.ts");

    assertTrue(router.contains("\"#admin/repository/cleanup\": \"cleanup-policies\""));
    assertTrue(router.contains("\"#admin/repository/blob-stores\": \"blobstores\""));
    assertTrue(router.contains("\"#admin/repository/docker-registry\": \"docker-registry\""));
    assertTrue(router.contains("\"#admin/security/apikeys\": \"security-api-keys\""));
    assertTrue(router.contains("\"#admin/security/scanning\": \"security-scanning\""));
    assertTrue(router.contains("\"#admin/security/audit\": \"security-audit-log\""));
    assertTrue(router.contains("\"#admin/system/ui\": \"ui-settings\""));
    assertTrue(router.contains("\"#admin/migration\": \"nexus-migration\""));
  }

  @Test
  void everyNavigationDestinationIsWiredToAView() throws IOException {
    String router = ui("src/admin/router.ts");
    List<String> ids = navIds(ui("src/admin/nav.ts"));

    assertFalse(ids.isEmpty(), "navigation ids");
    // Every navigation id must appear in the VIEWS map; otherwise the console would
    // fall back to the placeholder for a shipped view.
    for (String id : ids) {
      assertTrue(router.contains("\"" + id + "\":") || router.contains(id + ":"), "VIEWS entry for " + id);
    }
  }

  @Test
  void hashHistoryKeepsTheLegacyUrlShape() throws IOException {
    String history = ui("src/shared/router/legacy-hash-history.ts");

    assertTrue(history.contains("toLegacyHash"), "legacy hash writer");
    assertTrue(history.contains("replace(/^\\//, \"\")"), "strips the leading slash");
  }

  private static List<String> navIds(String nav) {
    List<String> ids = new ArrayList<>();
    for (String line : nav.split("\n")) {
      int start = line.indexOf("id: \"");
      if (start < 0) {
        continue;
      }
      int begin = start + "id: \"".length();
      int end = line.indexOf('"', begin);
      if (end > begin) {
        ids.add(line.substring(begin, end));
      }
    }
    return ids;
  }
}
