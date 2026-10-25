package com.github.klboke.kkrepo.browse.ui;

import static com.github.klboke.kkrepo.browse.ui.UiSources.ui;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import org.junit.jupiter.api.Test;

/**
 * Sign-in must keep working after the browse page became a Vue application: the legacy page loaded
 * {@code /login/assets/login-modal.js}, which no longer exists.
 */
class BrowseUiLoginContractTest {

  @Test
  void loginDialogCallsTheSameServerEndpoints() throws IOException {
    String login = ui("src/shared/components/LoginDialog.vue");

    assertTrue(login.contains("/internal/security/login/options"), "login options");
    assertTrue(login.contains("\"/internal/security/login\""), "password login");
    assertTrue(login.contains("/internal/security/oidc/login"), "OIDC login redirect");
    assertTrue(login.contains("safeReturnTo"), "return-to validation");
  }

  @Test
  void browseAppOpensTheDialogForLoginRequests() throws IOException {
    String app = ui("src/browse/App.vue");

    assertTrue(app.contains("loginOpen"), "login state");
    assertTrue(app.contains("params.get(\"login\") === \"1\""), "?login=1 handling");
    assertTrue(app.contains("LoginDialog"), "dialog mounted");
  }

  @Test
  void loginKeepsTheLegacyFailureMessage() throws IOException {
    String login = ui("src/shared/components/LoginDialog.vue");
    assertTrue(login.contains("Invalid username or password."), "auth failure message");
  }
}
