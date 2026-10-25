// Normalises a Vite build for Spring Boot serving.
//
// Vite emits `browse.html` for the browse entry because that is the source file
// name. Spring serves `index.html` from the classpath resource directory, so the
// browse build renames the emitted document. Asset URLs already point at
// `/browse/assets/...` because Vite used the target `base`.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const OUT_DIRS = {
  admin: resolve(root, "../admin-ui/src/main/resources/META-INF/resources/admin"),
  browse: resolve(root, "../browse-ui/src/main/resources/META-INF/resources/browse"),
};

const target = process.argv[2] ?? process.env.KKREPO_UI_TARGET ?? "admin";
const outDir = process.env.KKREPO_UI_OUT ?? OUT_DIRS[target];

if (!outDir) {
  console.error(`Unknown target "${target}"; expected admin or browse.`);
  process.exit(1);
}
if (!existsSync(outDir)) {
  console.error(`Output directory does not exist: ${outDir}`);
  process.exit(1);
}

if (target === "browse") {
  const source = join(outDir, "browse.html");
  const destination = join(outDir, "index.html");
  if (existsSync(source)) {
    writeFileSync(destination, readFileSync(source, "utf8"), "utf8");
    rmSync(source);
  } else {
    console.error(`Expected ${source} from the browse build.`);
    process.exit(1);
  }
} else if (target === "admin") {
  const source = join(outDir, "admin.html");
  const destination = join(outDir, "index.html");
  if (existsSync(source)) {
    writeFileSync(destination, readFileSync(source, "utf8"), "utf8");
    rmSync(source);
  } else {
    console.error(`Expected ${source} from the admin build.`);
    process.exit(1);
  }
}

console.log(`Prepared ${target} output in ${outDir}`);
