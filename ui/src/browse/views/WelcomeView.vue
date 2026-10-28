<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";
import { writeClipboard } from "../../shared/clipboard";
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
    <h3 class="kk-schema-form__group kk-format-group__title">{{ group.format }}</h3>
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
                class="micl-chip-assist micl-chip--elevated kk-badge kk-pill-badge"
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

