package com.github.klboke.kkrepo.browse.ui;

import static com.github.klboke.kkrepo.browse.ui.UiSources.ui;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Existing browse bookmarks and deep links use the {@code #browse/...} hash shape, so the parse
 * table is a compatibility contract, not an implementation detail.
 */
class BrowseUiRouteContractTest {

  @Test
  void hashPrefixIsUnchanged() throws IOException {
    String route = ui("src/browse/route.ts");
    assertTrue(route.contains("export const BROWSE_PREFIX = \"#browse/\""), "hash prefix");
  }

  @Test
  void everyLegacyRouteShapeStillParses() throws IOException {
    String route = ui("src/browse/route.ts");

    for (String token : List.of("welcome", "browse", "search", "upload", "my-token")) {
      assertTrue(route.contains("case \"" + token + "\"") || route.contains("\"" + token + "\""), token);
    }
    // `#browse/browse:<repo>:<path>` splits on the colon separator.
    assertTrue(route.contains("segments.slice(2).join(\":\")"), "repository path tail");
  }

  @Test
  void everyViewIsImplementedAndWired() throws IOException {
    String app = ui("src/browse/App.vue");

    for (String view : List.of("WelcomeView", "BrowseView", "SearchView", "UploadView", "MyTokenView")) {
      assertTrue(app.contains(view), view + " import");
      assertTrue(UiSources.uiFileExists("src/browse/views/" + view + ".vue"), view + " file");
    }
  }

  @Test
  void apiSurfaceMatchesTheServerEndpoints() throws IOException {
    String app = ui("src/browse/App.vue");
    String browse = ui("src/browse/views/BrowseView.vue");
    String search = ui("src/browse/views/SearchView.vue");
    String upload = ui("src/browse/views/UploadView.vue");
    String token = ui("src/browse/views/MyTokenView.vue");

    assertTrue(app.contains("/internal/repositories"), "repository catalog");
    assertTrue(browse.contains("/internal/browse/"), "directory listing");
    assertTrue(search.contains("/internal/search/components"), "component search");
    assertTrue(upload.contains("/service/rest/v1/components"), "component upload");
    assertTrue(token.contains("/internal/security/api-keys/current"), "own API keys");
    assertFalse(browse.contains("/internal/browse/${encodeURIComponent(props.repo)}/"), "no trailing slash");
  }
}
