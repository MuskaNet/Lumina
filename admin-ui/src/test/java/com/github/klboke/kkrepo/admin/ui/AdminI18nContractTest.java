package com.github.klboke.kkrepo.admin.ui;

import static com.github.klboke.kkrepo.admin.ui.UiSources.ui;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The legacy shared dictionary moved from {@code ui-i18n.js} to a JSON resource. A migration that
 * silently drops translations would be invisible until a Chinese user opened the console.
 */
class AdminI18nContractTest {

  @Test
  void dictionaryRetainsTheMigratedTranslations() throws IOException {
    String json = ui("src/shared/i18n/zh-CN.json");
    int entries = UiSources.occurrences(json, "\": \"");
    assertTrue(entries >= 600, "expected at least 600 translated strings, found " + entries);
  }

  @Test
  void dictionaryKeepsRepresentativeDomainStrings() throws IOException {
    String json = ui("src/shared/i18n/zh-CN.json");

    for (String key : List.of(
        "\"Loading usage…\"",
        "\"Stored blob size\"",
        "\"Pending cleanup\"",
        "\"Copy URL\"",
        "\"Matching repositories\"")) {
      assertTrue(json.contains(key), key);
    }
  }

  @Test
  void translatorFallsBackToTheSourceString() throws IOException {
    String i18n = ui("src/shared/i18n/index.ts");

    assertTrue(i18n.contains("translations[text] ?? text"), "fallback to the source string");
    assertTrue(i18n.contains("resolveLanguage"), "browser language resolution");
  }
}
