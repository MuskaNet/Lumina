package com.github.klboke.kkrepo.browse.ui;

import static com.github.klboke.kkrepo.browse.ui.UiSources.resource;
import static com.github.klboke.kkrepo.browse.ui.UiSources.resourceExists;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import org.junit.jupiter.api.Test;

/** Guards the browse entry point served by Spring Boot for {@code /browse/}. */
class BrowseUiEntryPointContractTest {

  @Test
  void entryPointLoadsTheBundledApplication() throws IOException {
    String index = resource("/META-INF/resources/browse/index.html");

    assertTrue(index.contains("src=\"/browse/assets/app.js\""), "browse bundle script");
    assertTrue(index.contains("href=\"/browse/assets/app.css\""), "browse bundle stylesheet");
    assertTrue(index.contains("<div id=\"app\"></div>"), "Vue mount point");
  }

  @Test
  void entryPointKeepsMavenVersionFiltering() throws IOException {
    String index = resource("/META-INF/resources/browse/index.html");
    assertTrue(index.contains("<meta name=\"kkrepo-version\" content=\""), "version meta tag");
    assertFalse(index.contains("@project.version@"), "unfiltered Maven placeholder");
  }

  @Test
  void entryPointStaysCompatibleWithTheSelfOnlyContentSecurityPolicy() throws IOException {
    String index = resource("/META-INF/resources/browse/index.html");

    assertFalse(index.contains("<script>"), "inline script");
    assertFalse(index.contains("javascript:"), "javascript: URL");
    assertFalse(index.toLowerCase().contains("unsafe-eval"), "unsafe-eval directive");
  }

  @Test
  void bundledAssetsArePresent() {
    assertTrue(resourceExists("/META-INF/resources/browse/assets/app.js"), "app.js");
    assertTrue(resourceExists("/META-INF/resources/browse/assets/app.css"), "app.css");
    assertTrue(
        resourceExists("/META-INF/resources/browse/assets/material-symbols.woff2"),
        "self-hosted Material Symbols font");
  }

  @Test
  void legacyBrowseBundlesAndThemeStylesheetsAreGone() {
    assertFalse(resourceExists("/META-INF/resources/browse/assets/browse.js"), "legacy browse.js");
    assertFalse(resourceExists("/META-INF/resources/browse/assets/browse.css"), "legacy browse.css");
    assertFalse(
        resourceExists("/META-INF/resources/browse/assets/lucide-icons.css"),
        "legacy lucide sprite");
    assertFalse(
        resourceExists("/META-INF/resources/browse/assets/themes/default.css"),
        "legacy theme stylesheet");
  }
}
