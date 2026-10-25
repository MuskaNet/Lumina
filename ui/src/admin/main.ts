import { createApp } from "vue";
import "material-inspired-component-library/dist/micl.css";
import micl from "material-inspired-component-library/dist/micl";
import "../shared/theme/themes.generated.css";
import "../shared/fonts/material-symbols.css";
import "../shared/format-icons/format-icons.css";
import "../shared/styles/app.css";

import App from "./App.vue";
import { router } from "./router";
import { initTheme } from "../shared/theme";
import { applyLanguagePreference } from "../shared/i18n";
import { readSettings } from "../shared/settings";
import { installMiclValueSync } from "../shared/micl-sync";

installMiclValueSync();
initTheme();
document.body.classList.add("micl-window");
applyLanguagePreference(readSettings().defaultLanguage);

createApp(App).use(router).mount("#app");

// MICL registers its progressive enhancements after mount so the runtime
// observes the nodes Vue renders.
micl.initialize();
