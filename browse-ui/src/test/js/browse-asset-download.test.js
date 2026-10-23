const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = readFileSync(resolve(__dirname,
  "../../main/resources/META-INF/resources/browse/assets/browse.js"), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, name);
  const end = source.indexOf("\n}\n", start);
  return source.slice(start, end + 3);
}

function render(downloadUrl) {
  const context = vm.createContext({
    lucideIcon: () => "<svg></svg>",
  });
  vm.runInContext([
    "escapeHtml",
    "renderAssetDownloadLink",
  ].map(extractFunction).join("\n"), context);
  return context.renderAssetDownloadLink(downloadUrl);
}

test("asset download links escape attribute-breaking path content", () => {
  const payload = "/repository/raw/archive.zip\" onmouseover=\"alert(1)\" data-x=\"";
  const html = render(payload);

  assert.match(html, /href="\/repository\/raw\/archive\.zip&quot; onmouseover=&quot;alert\(1\)&quot; data-x=&quot;"/);
  assert.doesNotMatch(html, /" onmouseover="/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

test("asset download links ignore non-string or empty targets", () => {
  assert.equal(render(""), "");
  assert.equal(render(null), "");
  assert.equal(render({ href: "/repository/raw/archive.zip" }), "");
});
