package com.github.klboke.kkrepo.admin.ui;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

/**
 * Runs the UI unit suite (Vitest) from the Maven build so pure logic regressions fail here.
 *
 * <p>Skipped when Node.js or the {@code ui/node_modules} install is missing, matching the previous
 * {@code node --test} bridge. Run {@code npm install} in {@code ui/} to enable it.
 */
class UiUnitTestBridge {

  @Test
  void uiUnitTestsPass() throws Exception {
    assumeTrue(nodeIsAvailable(), "Node.js is required for the UI unit tests");
    Path ui = Path.of("..", "ui");
    assumeTrue(Files.isDirectory(ui.resolve("node_modules")), "run npm install in ui/ first");

    Process process = new ProcessBuilder(
        isWindows() ? "npm.cmd" : "npm",
        "test",
        "--silent")
        .directory(ui.toFile())
        .redirectErrorStream(true)
        .start();

    if (!process.waitFor(180, TimeUnit.SECONDS)) {
      process.destroyForcibly();
      process.waitFor(5, TimeUnit.SECONDS);
      String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
      fail("Timed out running the UI unit tests:\n" + output);
    }
    String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    assertEquals(0, process.exitValue(), () -> output);
  }

  private static boolean isWindows() {
    return System.getProperty("os.name", "").toLowerCase().contains("win");
  }

  private static boolean nodeIsAvailable() {
    try {
      Process process = new ProcessBuilder("node", "--version").redirectErrorStream(true).start();
      if (!process.waitFor(10, TimeUnit.SECONDS)) {
        process.destroyForcibly();
        return false;
      }
      return process.exitValue() == 0;
    } catch (IOException exception) {
      return false;
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      return false;
    }
  }
}
