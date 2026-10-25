package com.github.klboke.kkrepo.admin.ui;

import static com.github.klboke.kkrepo.admin.ui.UiSources.ui;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import org.junit.jupiter.api.Test;

/**
 * Guards the repository dialog against drifting from the server-side recipe contract.
 *
 * <p>The Vue migration originally shipped APT/Alpine metadata modes of SIGNED/UNSIGNED and APK
 * signature types of RSA_SHA256/RSA_SHA512. Neither exists on the server: it accepts only
 * PASSTHROUGH/RESIGN and RSA/RSA256/RSA512, so creating those repositories failed validation.
 */
class RepositoryFormContractTest {

  @Test
  void metadataModesMatchTheServerEnum() throws IOException {
    String form = ui("src/admin/repositoryForm.ts");

    assertTrue(form.contains("value: \"PASSTHROUGH\""), "PASSTHROUGH mode");
    assertTrue(form.contains("value: \"RESIGN\""), "RESIGN mode");
    assertFalse(form.contains("value: \"SIGNED\""), "legacy SIGNED mode");
    assertFalse(form.contains("value: \"UNSIGNED\""), "legacy UNSIGNED mode");
  }

  @Test
  void apkSignatureTypesMatchTheServerEnum() throws IOException {
    String form = ui("src/admin/repositoryForm.ts");

    for (String type : new String[] {"RSA", "RSA256", "RSA512"}) {
      assertTrue(form.contains("value: \"" + type + "\""), "APK signature type " + type);
    }
    assertFalse(form.contains("RSA_SHA256"), "legacy RSA_SHA256 value");
    assertFalse(form.contains("RSA_SHA512"), "legacy RSA_SHA512 value");
  }

  @Test
  void dialogUsesTheSharedFormChoices() throws IOException {
    String view = ui("src/admin/views/RepositoriesView.vue");

    assertTrue(view.contains("APT_METADATA_MODES"), "APT choices come from the shared module");
    assertTrue(view.contains("ALPINE_METADATA_MODES"), "Alpine choices come from the shared module");
    assertTrue(view.contains("ALPINE_SIGNATURE_TYPES"), "APK signature choices come from the shared module");
    assertFalse(view.contains("<option value=\"SIGNED\">"), "hand-written SIGNED option");
    assertFalse(view.contains("<option value=\"RSA_SHA256\">"), "hand-written RSA_SHA256 option");
  }

  @Test
  void hostedAndGroupRepositoriesForceLocallySignedMetadata() throws IOException {
    String form = ui("src/admin/repositoryForm.ts");

    // Normalize: APT hosted => RESIGN, Alpine non-proxy => RESIGN, proxy passthrough otherwise.
    assertTrue(form.contains("draft.aptMetadataMode = \"RESIGN\""), "hosted APT mode");
    assertTrue(form.contains("draft.alpineMetadataMode = \"RESIGN\""), "hosted/group Alpine mode");
    assertTrue(form.contains("flat || draft.aptMetadataMode !== \"RESIGN\""), "flat APT proxy passthrough");
  }

  @Test
  void officialProxySettingsAreExposed() throws IOException {
    String form = ui("src/admin/repositoryForm.ts");
    String view = ui("src/admin/views/RepositoriesView.vue");

    for (String field : new String[] {
        "remoteAuthenticationType",
        "remoteNtlmDomain",
        "remoteBearerToken",
        "outboundProxyType",
        "outboundProxyHost",
        "outboundProxyPort",
        "allowedRedirectHosts",
        "minimumReleaseAgeMinutes"}) {
      assertTrue(form.contains(field), "payload field " + field);
      assertTrue(view.contains(field), "dialog control " + field);
    }
    assertTrue(view.contains("alpineVerifyUpstreamSignatures"), "Alpine upstream verification control");
    assertTrue(view.contains("alpineUpstreamPublicKey"), "Alpine upstream trust control");
  }

  @Test
  void groupMemberTransferUsesMiclListsAndTheOfficialCandidateRules() throws IOException {
    String view = ui("src/admin/views/RepositoriesView.vue");
    String members = ui("src/admin/repositoryMembers.ts");

    assertTrue(view.contains("<M3List"), "MICL list transfer panes");
    assertTrue(view.contains("<M3ListItem"), "MICL list rows");
    assertTrue(view.contains("selectMemberCandidates"), "candidate filtering comes from the shared module");
    assertTrue(view.contains("memberAvailable"), "available members pane");
    assertTrue(view.contains("memberNames"), "ordered selected members pane");

    assertTrue(members.contains("export const NESTED_GROUP_FORMATS"), "nested group allow-list");
    for (String format : new String[] {
        "pub", "composer", "terraform", "swift", "ansiblegalaxy", "conda"}) {
      assertTrue(members.contains("\"" + format + "\""), "nested group format " + format);
    }
    assertTrue(
        members.contains("if (String(repo.format ?? \"\") !== format) return false;"),
        "same-format candidates only");
    assertTrue(
        members.contains(
            "if (String(repo.type ?? \"\").toUpperCase() === \"GROUP\" && !allowNestedGroups) return false;"),
        "nested groups only where the protocol supports them");
    assertTrue(
        members.contains("export function addMemberNames")
            && members.contains("export function removeMemberNames")
            && members.contains("export function moveMember"),
        "ordered add/remove/reorder helpers");
  }

  @Test
  void conanStatusPanelReadsTheServerStatusFields() throws IOException {
    String view = ui("src/admin/views/RepositoriesView.vue");
    String status = ui("src/admin/repositoryStatus.ts");

    assertTrue(view.contains("/conan/status"), "Conan status endpoint");
    assertTrue(view.contains("formatConanStatus"), "Conan status formatter");
    assertTrue(view.contains("Refresh status"), "status refresh control");
    for (String field : new String[] {
        "recipes",
        "recipeRevisions",
        "packages",
        "packageRevisions",
        "committedFiles",
        "openUploadSessions",
        "cachedProxyFiles"}) {
      assertTrue(status.contains(field), "Conan status field " + field);
    }
  }

  @Test
  void alpineRebuildSendsTheNamespaceTheServerRequires() throws IOException {
    String view = ui("src/admin/views/RepositoriesView.vue");
    String form = ui("src/admin/repositoryForm.ts");

    assertTrue(form.contains("export function firstAlpineNamespace"), "namespace derivation helper");
    assertTrue(view.contains("firstAlpineNamespace(draft)"), "dialog uses the helper");
    assertTrue(view.contains("/alpine/rebuild"), "Alpine rebuild endpoint");
    assertTrue(view.contains("namespace,"), "rebuild body carries the namespace");
    for (String segment : new String[] {"v3.23", "main", "x86_64"}) {
      assertTrue(form.contains("\"" + segment + "\""), "namespace fallback " + segment);
    }
  }

  @Test
  void signingTabCoversProxyAptAndEveryAlpineRepository() throws IOException {
    String view = ui("src/admin/views/RepositoriesView.vue");

    // Official console: apt operations for hosted/proxy apt, alpine operations for every type.
    assertTrue(
        view.contains(
            "((draftFormat.value === \"apt\" && !isGroup.value) || draftFormat.value === \"alpine\")"),
        "signing tab visibility");
    assertTrue(view.contains("/alpine/public-key"), "Alpine public key download");
    assertTrue(view.contains("Download public key"), "public key download button");
    assertTrue(view.contains("formatAlpineStatus"), "Alpine signing status summary");
    assertTrue(view.contains("formatAptStatus"), "APT signing status summary");
  }
}
