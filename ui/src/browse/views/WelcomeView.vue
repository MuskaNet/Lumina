<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import { writeClipboard } from "../../shared/clipboard";
import { formatLogoClass } from "../../shared/formatIcons";
import { repositoryClientUrl } from "../repositoryUrls";

interface Repository {
  name: string;
  type?: string | null;
  format?: string | null;
  online?: boolean;
  url?: string | null;
  docker?: { connectorEnabled?: boolean | null; connectorPort?: number | string | null; connectorPublicUrl?: string | null } | null;
}

const props = defineProps<{ repositories: Repository[] }>();
const emit = defineEmits<{ open: [repo: string] }>();

const grouped = computed(() => {
  const groups = new Map<string, Repository[]>();
  for (const repo of props.repositories) {
    const format = String(repo.format ?? "other");
    const list = groups.get(format) ?? [];
    list.push(repo);
    groups.set(format, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([format, repos]) => ({ format, repos: repos.sort((a, b) => a.name.localeCompare(b.name)) }));
});

function formatDisplayName(format: string) {
  const labels: Record<string, string> = {
    alpine: "Alpine",
    apt: "APT",
    docker: "Docker",
    maven2: "Maven",
    npm: "npm",
    pypi: "PyPI",
    rubygems: "RubyGems",
    terraform: "Terraform",
  };
  return labels[format.toLowerCase()] ?? format.charAt(0).toUpperCase() + format.slice(1).toLowerCase();
}

async function copyUrl(repo: Repository) {
  try {
    await writeClipboard(repositoryClientUrl(repo));
    showToast(t("Copied"), "ok");
  } catch {
    showToast(t("Unable to copy repository URL"), "error");
  }
}
</script>

<template>
  <section class="kk-welcome-header">
    <span class="kk-welcome-header__shape kk-welcome-header__shape--burst" aria-hidden="true"></span>
    <span class="kk-welcome-header__shape kk-welcome-header__shape--diamond" aria-hidden="true"></span>
    <span class="kk-welcome-header__shape kk-welcome-header__shape--pill" aria-hidden="true"></span>
    <div class="kk-welcome-header__content">
      <h2 class="kk-empty-state__title">{{ t("Browse repositories") }}</h2>
      <p class="kk-empty-state__body">
        {{ t("Select a repository to browse its stored components, or search across every repository.") }}
      </p>
      <p class="kk-empty-state__body kk-hint">
        {{ t("Lumina is a fork of kkRepo designed to provide a more aesthetically pleasing Material Design 3 Expressive user interface, built with the MICL component library.") }}
      </p>
    </div>
  </section>

  <div v-for="group in grouped" :key="group.format" class="kk-format-group">
    <h3 class="kk-schema-form__group kk-format-group__title">
      <span :class="formatLogoClass(group.format)" aria-hidden="true"></span>
      <span>{{ formatDisplayName(group.format) }}</span>
    </h3>
    <p class="kk-hint kk-format-group__hint">
      {{ t("Copy a repository URL from the list below, or open a repository to browse it.") }}
    </p>
    <div class="kk-repo-grid">
      <article v-for="repo in group.repos" :key="repo.name" tabindex="0" class="micl-card-elevated kk-repo-card">
        <div class="micl-card__headline-l kk-repo-card__headline">
          <button
            type="button"
            class="kk-repo-card__open"
            :aria-label="repo.name"
            @click="emit('open', repo.name)"
          >
            <span class="material-symbols-outlined kk-repo-card__icon" aria-hidden="true">inventory_2</span>
            <span class="kk-repo-card__body">
              <strong>{{ repo.name }}</strong>
              <small class="kk-secondary">{{ repo.type }} · {{ repo.online ? t("Online") : t("Offline") }}</small>
            </span>
            <span class="micl-chips kk-chip-host">
              <span
                class="micl-chip-assist kk-badge kk-pill-badge"
                :class="repo.type === 'group' ? 'kk-badge--warn' : repo.type === 'proxy' ? 'kk-badge--checking' : 'kk-badge--ok'"
              >
                {{ repo.type }}
              </span>
            </span>
          </button>
        </div>
        <div class="micl-card__content kk-repo-card__content">
          <button
            type="button"
            class="kk-location kk-repo-card__url"
            :title="t('Copy repository URL')"
            @click="copyUrl(repo)"
          >
            <code class="kk-mono">{{ repositoryClientUrl(repo) }}</code>
            <span class="material-symbols-outlined kk-repo-card__copy-icon" aria-hidden="true">content_copy</span>
          </button>
        </div>
      </article>
    </div>
  </div>

  <p v-if="!grouped.length" class="kk-muted">{{ t("No repositories are available.") }}</p>
</template>

<style scoped>
.kk-welcome-header {
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: start;
  padding: 56px 36px;
  background-color: var(--md-sys-color-primary-container, var(--md-sys-color-surface-container-low));
  border-radius: 28px;
  position: relative;
  overflow: hidden;
  isolation: isolate;
}

.kk-welcome-header__shape {
  position: absolute;
  z-index: -1;
  display: block;
  background-color: var(--md-sys-color-secondary-container, var(--md-sys-color-surface-container-high));
  pointer-events: none;
  opacity: 0.82;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.kk-welcome-header__shape--burst {
  inset-block-start: -3.5rem;
  inset-inline-end: -2.5rem;
  inline-size: 15rem;
  block-size: 15rem;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M50 2c8 0 8 12 16 12s8-8 16-3 0 13 8 17 13-2 9 8-13 5-10 14 12 10 5 16-11-3-16 5-3 14-12 11-7-12-16-9-12 10-17 1 5-13-3-18-14 1-15-8 12-9 8-17-13-8-5-15 12 4 17-4S42 2 50 2Z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M50 2c8 0 8 12 16 12s8-8 16-3 0 13 8 17 13-2 9 8-13 5-10 14 12 10 5 16-11-3-16 5-3 14-12 11-7-12-16-9-12 10-17 1 5-13-3-18-14 1-15-8 12-9 8-17-13-8-5-15 12 4 17-4S42 2 50 2Z'/%3E%3C/svg%3E");
}

.kk-welcome-header__shape--diamond {
  inset-block-end: -4rem;
  inset-inline-end: 11rem;
  inline-size: 9rem;
  block-size: 9rem;
  background-color: var(--md-sys-color-tertiary-container, var(--md-sys-color-surface-container-high));
  opacity: 0.7;
  transform: rotate(-12deg);
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='m50 2 12 25 26 9-20 18 3 27-21-12-24 12 3-27L9 36l27-9L50 2Z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='m50 2 12 25 26 9-20 18 3 27-21-12-24 12 3-27L9 36l27-9L50 2Z'/%3E%3C/svg%3E");
}

.kk-welcome-header__shape--pill {
  inset-block-start: 2rem;
  inset-inline-end: 32%;
  inline-size: 7rem;
  block-size: 3rem;
  background-color: var(--md-sys-color-primary, var(--md-sys-color-on-primary-container));
  opacity: 0.18;
  transform: rotate(-18deg);
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 40'%3E%3Crect x='2' y='2' width='96' height='36' rx='18'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 40'%3E%3Crect x='2' y='2' width='96' height='36' rx='18'/%3E%3C/svg%3E");
}

.kk-welcome-header__content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-inline-size: 720px;
}

.kk-welcome-header .kk-empty-state__title {
  margin: 0;
  font-family: var(--md-ref-typeface-brand, var(--md-ref-typeface-plain));
  font-size: clamp(1.75rem, 3vw, 2.35rem);
  font-weight: 700;
  color: var(--md-sys-color-on-primary-container, var(--md-sys-color-on-surface));
  letter-spacing: -0.025em;
}

.kk-welcome-header .kk-empty-state__body {
  margin: 0;
  font-size: var(--md-sys-typescale-body-medium-size, 0.9375rem);
  line-height: 1.6;
  color: var(--md-sys-color-on-primary-container, var(--md-sys-color-on-surface-variant));
}

.kk-welcome-header .kk-hint {
  font-size: var(--md-sys-typescale-body-small-size, 0.8125rem);
  color: var(--md-sys-color-on-primary-container, var(--md-sys-color-on-surface-variant));
  opacity: 0.88;
}

@media (max-width: 768px) {
  .kk-welcome-header {
    padding: 36px 20px;
    border-radius: 20px;
  }
}

.kk-format-group {
  margin-block-start: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kk-format-group__title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 4px 0;
  font-size: 0.9375rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  color: var(--md-sys-color-on-surface);
}

.kk-format-group__title::before {
  display: none;
}

.kk-format-group__title .format-logo {
  inline-size: 22px;
  block-size: 22px;
  flex: 0 0 22px;
}

.kk-format-group__hint {
  margin: 0 0 12px 14px;
}

.kk-repo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 1080px) {
  .kk-repo-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .kk-repo-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

.kk-repo-card {
  --md-comp-card-content-padding-block: 0px;
  --md-comp-card-padding-inline: 0px;
  --md-comp-card-gap: 0px;
  --_card-elevation: none;
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  gap: 26px;
  padding: 18px 20px;
  border-radius: 24px;
  background-color: var(--md-sys-color-surface-container);
  color: inherit;
  font: inherit;
  text-align: start;
}

.kk-repo-card:hover,
.kk-repo-card:focus-within {
  --_card-elevation: none;
}

.kk-repo-card__headline,
.kk-repo-card__content {
  padding: 0;
}

.kk-repo-card__content {
  margin-block-start: 16px;
}

.kk-repo-card__open {
  display: flex;
  align-items: center;
  gap: 12px;
  inline-size: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.kk-repo-card__open:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 4px;
  border-radius: 16px;
}

.kk-repo-card__icon {
  font-size: 26px !important;
  color: var(--md-sys-color-primary);
  flex-shrink: 0;
}

.kk-repo-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

.kk-repo-card__body strong {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  line-height: 1.3;
}

.kk-repo-card .kk-pill-badge {
  flex-shrink: 0;
  margin-inline-start: auto;
}

.kk-location.kk-repo-card__url {
  box-sizing: border-box;
  inline-size: 100%;
  min-inline-size: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background-color: var(--md-sys-color-surface-container-low);
  border: 0;
  color: var(--md-sys-color-on-surface-variant);
  font-size: var(--md-sys-typescale-body-small-size);
  cursor: pointer;
  transition: all 150ms ease;
  text-align: start;
}

.kk-repo-card__url:hover {
  background-color: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface);
}

.kk-repo-card__url code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kk-repo-card__copy-icon {
  font-size: 16px;
  opacity: 0.6;
  flex-shrink: 0;
}

.kk-repo-card__url:hover .kk-repo-card__copy-icon {
  opacity: 1;
  color: var(--md-sys-color-primary);
}
</style>
