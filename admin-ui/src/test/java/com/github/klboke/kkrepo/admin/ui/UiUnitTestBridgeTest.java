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
 * <p>Skipped when Node.js or the {@code ui/node_modules} install is missing. Run
 * {@code npm install} in {@code ui/} to enable it. The class name must end with {@code Test}
 * so Surefire's default includes pick it up.
 *
 * <p>The suite writes its report to a temporary file instead of a pipe. A pipe would have to be
 * drained while the child runs: once the suite grew past the OS pipe buffer the child blocked
 * writing its summary, and the run only ever finished by hitting the timeout.
 */
class UiUnitTestBridgeTest {

  private static final long TIMEOUT_SECONDS = 300;

  @Test
  void uiUnitTestsPass() throws Exception {
    assumeTrue(nodeIsAvailable(), "Node.js is required for the UI unit tests");
    Path ui = Path.of("..", "ui");
    assumeTrue(Files.isDirectory(ui.resolve("node_modules")), "run npm install in ui/ first");

    Path report = Files.createTempFile("kkrepo-ui-unit-", ".log");
    String output;
    try {
      Process process = new ProcessBuilder(
          isWindows() ? "npm.cmd" : "npm",
          "test",
          "--silent")
          .directory(ui.toFile())
          .redirectErrorStream(true)
          .redirectOutput(report.toFile())
          .start();

      boolean finished = process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
      if (!finished) {
        process.destroyForcibly();
        process.waitFor(5, TimeUnit.SECONDS);
      }
      output = Files.readString(report, StandardCharsets.UTF_8);
      if (!finished) {
        fail("Timed out running the UI unit tests:\n" + output);
      }
      assertEquals(0, process.exitValue(), () -> output);
    } finally {
      Files.deleteIfExists(report);
    }
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
