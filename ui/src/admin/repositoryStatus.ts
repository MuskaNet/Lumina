/**
 * Human-readable summaries for the repository status panels.
 *
 * Field names mirror the server records (`AptService.Status`, `AlpineService.Status`,
 * `ConanRegistryDao.RepositoryStatus`) so a backend rename fails the unit tests
 * instead of silently rendering an empty panel.
 */

import { t } from "../shared/i18n";

export interface ConanRepositoryStatus {
  repositoryRevision?: number | null;
  recipes?: number | null;
  recipeRevisions?: number | null;
  packages?: number | null;
  packageRevisions?: number | null;
  committedFiles?: number | null;
  openUploadSessions?: number | null;
  cachedProxyFiles?: number | null;
}

export interface AptKeyStatus {
  revision?: number | null;
  keyId?: string | null;
  fingerprint?: string | null;
  createdAt?: string | null;
}

export interface AptSuiteStatus {
  distribution?: string | null;
  desiredRevision?: number | null;
  publishedRevision?: number | null;
  lastError?: string | null;
}

export interface AptProxyStatus {
  distribution?: string | null;
  indexCount?: number | null;
  signatureVerified?: boolean | null;
}

export interface AptStatus {
  suites?: AptSuiteStatus[] | null;
  activeKey?: AptKeyStatus | null;
  proxyDistributions?: AptProxyStatus[] | null;
}

export interface AlpineKeyStatus {
  revision?: number | null;
  keyFilename?: string | null;
  fingerprint?: string | null;
  signatureType?: string | null;
  createdAt?: string | null;
}

export interface AlpineNamespaceStatus {
  namespace?: string | null;
  desiredRevision?: number | null;
  publishedRevision?: number | null;
  lastError?: string | null;
}

export interface AlpineProxyStatus {
  namespace?: string | null;
  indexIdentity?: string | null;
  signatureVerified?: boolean | null;
}

export interface AlpineStatus {
  namespaces?: AlpineNamespaceStatus[] | null;
  activeKey?: AlpineKeyStatus | null;
  proxyNamespaces?: AlpineProxyStatus[] | null;
}

export function formatConanStatus(status: ConanRepositoryStatus): string {
  return [
    `${status.recipes ?? 0} ${t("recipes")}`,
    `${status.recipeRevisions ?? 0} ${t("recipe revisions")}`,
    `${status.packages ?? 0} ${t("packages")}`,
    `${status.packageRevisions ?? 0} ${t("package revisions")}`,
    `${status.committedFiles ?? 0} ${t("committed files")}`,
    `${status.openUploadSessions ?? 0} ${t("open upload sessions")}`,
    `${status.cachedProxyFiles ?? 0} ${t("cached proxy files")}`,
  ].join(" · ");
}

export function formatAptStatus(status: AptStatus): string {
  const key = status.activeKey
    ? `${t("key")} ${status.activeKey.fingerprint ?? t("unknown")} (${t("revision")} ${status.activeKey.revision ?? 0})`
    : t("signing key will be generated on first publication");
  const suites = status.suites?.length
    ? status.suites
      .map((suite) => {
        const failure = suite.lastError ? `, ${t("last error")}: ${suite.lastError}` : "";
        return `${suite.distribution ?? "?"}: ${suite.publishedRevision ?? 0}/${suite.desiredRevision ?? 0}${failure}`;
      })
      .join("; ")
    : t("no metadata snapshot published");
  const proxies = status.proxyDistributions?.length
    ? status.proxyDistributions
      .map((item) => `${item.distribution ?? "?"}: ${item.indexCount ?? 0} ${t("Release entries")}`)
      .join("; ")
    : "";
  return `${key}. ${t("Suites")}: ${suites}.${proxies ? ` ${t("Upstream")}: ${proxies}.` : ""}`;
}

export function formatAlpineStatus(status: AlpineStatus): string {
  const key = status.activeKey
    ? `${status.activeKey.keyFilename ?? t("unknown")} · ${status.activeKey.fingerprint ?? t("unknown")} · ${t("revision")} ${status.activeKey.revision ?? 0}`
    : t("no active signing key");
  const namespaces = status.namespaces?.length
    ? status.namespaces
      .map((item) => {
        const failure = item.lastError ? `, ${t("last error")}: ${item.lastError}` : "";
        return `${item.namespace ?? "?"}: ${item.publishedRevision ?? 0}/${item.desiredRevision ?? 0}${failure}`;
      })
      .join("; ")
    : t("no signed index snapshot published");
  const proxies = status.proxyNamespaces?.length
    ? status.proxyNamespaces
      .map((item) => `${item.namespace ?? "?"}: ${item.signatureVerified ? t("verified") : t("unverified")}`)
      .join("; ")
    : "";
  return `${t("Key")}: ${key}. ${t("Namespaces")}: ${namespaces}.${proxies ? ` ${t("Upstream")}: ${proxies}.` : ""}`;
}
