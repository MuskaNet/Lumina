import { createApp } from "vue";
import "material-inspired-component-library/dist/micl.css";
import micl from "material-inspired-component-library/dist/micl";
import "../shared/theme/themes.generated.css";
import "../shared/fonts/material-symbols.css";
import "../shared/format-icons/format-icons.css";
import "../shared/styles/app.css";

import App from "./App.vue";
import { initTheme } from "../shared/theme";
import { applyCachedUiPreferences, syncUiPreferencesFromServer } from "../shared/ui-preferences";
import { installMiclValueSync } from "../shared/micl-sync";

installMiclValueSync();
initTheme();
document.body.classList.add("micl-window");
applyCachedUiPreferences();

createApp(App).mount("#app");

// Apply the defaults stored on the server (readable before sign-in), keeping the
// cached values as the non-blocking fallback.
void syncUiPreferencesFromServer();

micl.initialize();
