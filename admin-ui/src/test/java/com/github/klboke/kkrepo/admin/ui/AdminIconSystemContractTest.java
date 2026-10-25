package com.github.klboke.kkrepo.admin.ui;

import static com.github.klboke.kkrepo.admin.ui.UiSources.ui;
import static com.github.klboke.kkrepo.admin.ui.UiSources.uiFileExists;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import org.junit.jupiter.api.Test;

/**
 * The console switched from a Lucide SVG sprite to a self-hosted Material Symbols subset. This
 * pins that decision so a future change cannot silently reintroduce the old icon system.
 */
class AdminIconSystemContractTest {

  @Test
  void fontStylesheetDeclaresTheSelfHostedSubset() throws IOException {
    String css = ui("src/shared/fonts/material-symbols.css");

    assertTrue(css.contains("font-family: \"Material Symbols Outlined\""));
    assertTrue(css.contains("url(\"./material-symbols.woff2\")"));
    assertTrue(css.contains("font-feature-settings: \"liga\""));
    assertTrue(uiFileExists("src/shared/fonts/material-symbols.woff2"), "subset font file");
  }

  @Test
  void iconSubsetGeneratorKeepsTheRequiredLigatureFeature() throws IOException {
    String script = ui("scripts/build-icons.mjs");

    // Material Symbols maps icon names to glyphs through `rlig`. Subsetting with
    // `liga` only yields a tiny font whose glyphs no longer ligate.
    assertTrue(script.contains("keepFeatures: [\"rlig\"]"), "rlig must be retained");
    assertTrue(script.contains("material-symbols-outlined.woff2"), "font source");
  }

  @Test
  void componentsUseMaterialSymbolsInsteadOfLucideSprites() throws IOException {
    String shell = ui("src/shared/components/AppShell.vue");

    assertTrue(shell.contains("material-symbols-outlined"));
    assertFalse(shell.contains("lucide-icon"));
  }
}
