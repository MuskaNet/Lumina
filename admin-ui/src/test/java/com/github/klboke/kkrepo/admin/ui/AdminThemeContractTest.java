package com.github.klboke.kkrepo.admin.ui;

import static com.github.klboke.kkrepo.admin.ui.UiSources.occurrences;
import static com.github.klboke.kkrepo.admin.ui.UiSources.ui;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The six Nexus-era UI themes survive as Material 3 colour schemes. Every bundled theme must
 * produce both a light and a dark `--md-sys-color-*` block, and the theme list must stay aligned
 * with {@code UiSettingsController}.
 */
class AdminThemeContractTest {

  private static final List<String> THEMES =
      List.of("default", "indigo", "ocean", "sunset", "jfrog", "nexus");

  @Test
  void everyBundledThemeGeneratesLightAndDarkSchemes() throws IOException {
    String css = ui("src/shared/theme/themes.generated.css");

    for (String theme : THEMES) {
      String selector = ":root[data-theme=\"" + theme + "\"]";
      assertTrue(css.contains(selector + ".light, " + selector), theme + " light scheme");
      assertTrue(css.contains(selector + ".dark"), theme + " dark scheme");
    }
  }

  @Test
  void generatedSchemesCarryTheFullM3RoleSet() throws IOException {
    String css = ui("src/shared/theme/themes.generated.css");

    for (String role : List.of(
        "primary",
        "on-primary",
        "primary-container",
        "on-primary-container",
        "secondary",
        "tertiary",
        "error",
        "surface",
        "on-surface",
        "surface-container",
        "surface-container-highest",
        "outline",
        "outline-variant")) {
      assertTrue(
          occurrences(css, "--md-sys-color-" + role + ":") >= THEMES.size() * 2,
          "role " + role + " for every scheme");
    }
  }

  @Test
  void themeIdentifiersMatchTheServerAllowList() throws IOException {
    String settings = ui("src/shared/settings.ts");
    String generator = ui("scripts/build-themes.mjs");

    for (String theme : THEMES) {
      assertTrue(settings.contains("\"" + theme + "\""), "BUNDLED_THEMES entry " + theme);
      assertTrue(generator.contains("id: \"" + theme + "\""), "generator entry " + theme);
    }
  }

  @Test
  void themesAreGeneratedFromTheLegacyBrandColours() throws IOException {
    String generator = ui("scripts/build-themes.mjs");

    // Each theme keeps its existing brand colour as the M3 source colour.
    assertEquals(true, generator.contains("SchemeTonalSpot"));
    assertEquals(true, generator.contains("brand: \"#0e7c6f\""), "default brand");
    assertEquals(true, generator.contains("brand: \"#2f7650\""), "nexus brand");
  }

  @Test
  void entryDocumentsDeclareColorSchemeSupport() throws IOException {
    for (String document : List.of("admin.html", "browse.html")) {
      assertTrue(
          ui(document).contains("<meta name=\"color-scheme\" content=\"light dark\">"),
          document + " color-scheme meta");
    }
  }

  @Test
  void generatedStylesFallBackToTheSystemSchemeBeforeJavaScriptRuns() throws IOException {
    String css = ui("src/shared/theme/themes.generated.css");

    assertTrue(css.contains("@media (prefers-color-scheme: dark)"), "system dark fallback");
    assertTrue(css.contains(":not(.light)"), "fallback yields to an explicit light scheme");
  }

  @Test
  void themeBootstrapFollowsTheSystemColorScheme() throws IOException {
    String theme = ui("src/shared/theme/index.ts");

    assertTrue(theme.contains("(prefers-color-scheme: dark)"), "dark media query");
    assertTrue(theme.contains("matchMedia"), "media query lookup");
    assertTrue(theme.contains("addEventListener(\"change\""), "live appearance updates");
  }
}
