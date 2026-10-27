import { createApp } from "vue";
import "material-inspired-component-library/dist/micl.css";
import "material-inspired-component-library/dist/chip.css";
import "material-inspired-component-library/dist/buttongroup.css";
import micl from "material-inspired-component-library/dist/micl";
import "../shared/theme/themes.generated.css";
import "../shared/fonts/material-symbols.css";
import "../shared/format-icons/format-icons.css";
import "../shared/styles/app.css";

import App from "./App.vue";
import { router } from "./router";
import { initTheme } from "../shared/theme";
import { applyCachedUiPreferences, syncUiPreferencesFromServer } from "../shared/ui-preferences";
import { installMiclValueSync } from "../shared/micl-sync";

installMiclValueSync();
initTheme();
document.body.classList.add("micl-window");
applyCachedUiPreferences();

createApp(App).use(router).mount("#app");

// Apply the defaults stored on the server (readable before sign-in). The cached
// values were applied above, so a slow or failing request never blocks the console.
void syncUiPreferencesFromServer();

// MICL registers its progressive enhancements after mount so the runtime
// observes the nodes Vue renders.
micl.initialize();
