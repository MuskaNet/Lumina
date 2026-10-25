package com.github.klboke.kkrepo.server.browse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.github.klboke.kkrepo.core.RepositoryFormat;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/**
 * The console renders one icon per repository format. Every catalog format must have an icon
 * mapping so a newly added protocol does not appear with a fallback glyph.
 */
class WelcomeSupportedFormatsContractTest {

  @Test
  void everyRepositoryFormatHasAnIconMapping() throws IOException {
    Path view = Path.of("..", "ui", "src", "admin", "views", "RepositoriesView.vue");
    assertTrue(Files.exists(view), "missing " + view.toAbsolutePath());
    String source = Files.readString(view, StandardCharsets.UTF_8);

    int formatCount = RepositoryFormat.values().length;
    int mapped = 0;
    for (RepositoryFormat format : RepositoryFormat.values()) {
      if (source.contains(format.id() + ":")) {
        mapped++;
      }
    }
    assertEquals(formatCount, mapped, "every RepositoryFormat needs a FORMAT_ICONS entry");
  }

  @Test
  void welcomeViewGroupsRepositoriesByFormatComingFromTheServer() throws IOException {
    Path view = Path.of("..", "ui", "src", "browse", "views", "WelcomeView.vue");
    assertTrue(Files.exists(view), "missing " + view.toAbsolutePath());
    String source = Files.readString(view, StandardCharsets.UTF_8);

    // The format list is data-driven, so the UI cannot drift from the server catalog.
    assertTrue(source.contains("repo.format"), "format taken from the repository record");
    assertTrue(source.contains("/repository/"), "copyable repository URL");
  }
}
