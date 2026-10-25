package com.github.klboke.kkrepo.admin.ui;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Reads UI sources and packaged resources for the contract tests.
 *
 * <p>Source assertions read {@code ui/} directly so a broken generator or route table fails here
 * instead of only in the browser. Resource assertions read the packaged classpath, so they verify
 * what the server actually serves.
 */
final class UiSources {
  private UiSources() {
  }

  /** Reads a file inside {@code ui/}, e.g. {@code "src/admin/nav.ts"}. */
  static String ui(String relativePath) throws IOException {
    Path path = Path.of("..", "ui", relativePath);
    assertTrue(Files.exists(path), "missing UI source " + path.toAbsolutePath());
    return Files.readString(path, StandardCharsets.UTF_8);
  }

  static boolean uiFileExists(String relativePath) {
    return Files.exists(Path.of("..", "ui", relativePath));
  }

  /** Reads a packaged resource, e.g. {@code "/META-INF/resources/admin/index.html"}. */
  static String resource(String path) throws IOException {
    try (InputStream stream = UiSources.class.getResourceAsStream(path)) {
      return new String(Objects.requireNonNull(stream).readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  static boolean resourceExists(String path) {
    return Objects.nonNull(UiSources.class.getResource(path));
  }

  static int occurrences(String value, String token) {
    return value.split(Pattern.quote(token), -1).length - 1;
  }
}
