const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = readFileSync(resolve(__dirname,
  "../../main/resources/META-INF/resources/login/assets/safe-return-to.js"), "utf8");

function load() {
  const context = vm.createContext({
    URL,
    window: { location: { origin: "https://kkrepo.example.com" } },
  });
  vm.runInContext(source, context);
  return context.window.kkrepoSafeReturnTo;
}

test("preserves ordinary local return paths", () => {
  const safeReturnTo = load();
  for (const target of [
    "/browse/#browse/welcome",
    "/admin/?tab=repositories#repository-list",
    "/repository/raw/archive.zip",
    "/%5Cencoded-backslash",
  ]) {
    assert.equal(safeReturnTo(target, "/fallback"), target);
  }
});

test("rejects external, protocol-relative, backslash, and control-character targets", () => {
  const safeReturnTo = load();
  for (const target of [
    "",
    "https://evil.example/login",
    "//evil.example/login",
    "/\\evil.example/login",
    "/\t/evil.example/login",
    "/browse/\u0000welcome",
    "javascript:alert(1)",
    null,
  ]) {
    assert.equal(safeReturnTo(target, "/fallback"), "/fallback");
  }
});
