import { createApp } from "vue";
import "material-inspired-component-library/dist/micl.css";
import micl from "material-inspired-component-library/dist/micl";
import "../shared/theme/themes.generated.css";
import "../shared/fonts/material-symbols.css";
import "../shared/styles/app.css";

import App from "./App.vue";
import { initTheme } from "../shared/theme";
import { applyLanguagePreference } from "../shared/i18n";
import { readSettings } from "../shared/settings";

initTheme();
document.body.classList.add("micl-window");
applyLanguagePreference(readSettings().defaultLanguage);

createApp(App).mount("#app");

micl.initialize();
