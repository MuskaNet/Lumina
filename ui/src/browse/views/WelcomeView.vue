<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../shared/i18n";
import { showToast } from "../../shared/snackbar";

interface Repository {
  name: string;
  type?: string | null;
  format?: string | null;
  online?: boolean;
  url?: string | null;
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
  const base = `${globalThis.location.origin}/repository/${encodeURIComponent(repo.name)}/`;
  try {
    await navigator.clipboard.writeText(base);
    showToast(t("Copied to clipboard."), "ok");
  } catch {
    showToast(base, "ok");
  }
}
</script>

<template>
  <section class="kk-welcome-header">
    <h2 class="kk-empty-state__title">{{ t("Browse repositories") }}</h2>
    <p class="kk-empty-state__body">
      {{ t("Select a repository to browse its stored components, or search across every repository.") }}
    </p>
  </section>

  <div v-for="group in grouped" :key="group.format" class="kk-format-group">
    <h3 class="kk-schema-form__group">{{ group.format }}</h3>
    <p class="kk-hint kk-format-group__hint">
      {{ t("Copy a repository URL from the list below, or open a repository to browse it.") }}
    </p>
    <div class="kk-repo-grid">
      <article v-for="repo in group.repos" :key="repo.name" class="kk-repo-card">
        <button
          type="button"
          class="kk-repo-card__open"
          :aria-label="repo.name"
          @click="emit('open', repo.name)"
        >
          <span class="micl-list-item__icon material-symbols-outlined" aria-hidden="true">inventory_2</span>
          <span class="kk-repo-card__body">
            <strong>{{ repo.name }}</strong>
            <small class="kk-secondary">{{ repo.type }} · {{ repo.online ? t("Online") : t("Offline") }}</small>
          </span>
          <span
            class="kk-badge"
            :class="repo.type === 'group' ? 'kk-badge--warn' : repo.type === 'proxy' ? 'kk-badge--checking' : 'kk-badge--ok'"
          >
            {{ repo.type }}
          </span>
        </button>
        <button
          type="button"
          class="kk-location kk-repo-card__url"
          @click="copyUrl(repo)"
        >
          <code class="kk-mono">/repository/{{ repo.name }}/</code>
        </button>
      </article>
    </div>
  </div>

  <p v-if="!grouped.length" class="kk-muted">{{ t("No repositories are available.") }}</p>
</template>

