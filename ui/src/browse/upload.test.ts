import { describe, expect, it } from "vitest";
import { buildUploadForm, newUploadDraft, type UploadField, type UploadSpec } from "./upload";

const field = (name: string, type: UploadField["type"], optional = false): UploadField => ({ name, type, optional, description: name });
const file = (name: string) => new File(["fixture"], name);

function spec(format: string, multipleUpload = false, componentFields: UploadField[] = [], assetFields = [field("asset", "FILE")]): UploadSpec {
  return { format, multipleUpload, componentFields, assetFields };
}

describe("component upload multipart contract", () => {
  it("uses numbered raw file parts with per-file filenames", () => {
    const definition = spec("raw", true, [field("directory", "STRING")], [field("filename", "STRING"), field("asset", "FILE")]);
    const component = newUploadDraft(definition.componentFields);
    component.values.directory = "team/releases";
    const assets = ["one.txt", "two.txt"].map((name) => {
      const draft = newUploadDraft(definition.assetFields);
      draft.files.asset = file(name);
      draft.values.filename = name;
      return draft;
    });
    const form = buildUploadForm(definition, component, assets);
    expect([...form.keys()]).toEqual(["raw.directory", "raw.asset1", "raw.asset1.filename", "raw.asset2", "raw.asset2.filename"]);
    expect(form.get("raw.asset2.filename")).toBe("two.txt");
  });

  it("serializes Maven coordinates, boolean options, classifiers and extensions", () => {
    const definition = spec("maven2", true, [field("groupId", "STRING"), field("generate-pom", "BOOLEAN", true)],
      [field("classifier", "STRING", true), field("extension", "STRING"), field("asset", "FILE")]);
    const component = newUploadDraft(definition.componentFields);
    component.values.groupId = "org.example";
    component.values["generate-pom"] = true;
    const asset = newUploadDraft(definition.assetFields);
    asset.files.asset = file("demo.jar");
    asset.values.extension = "jar";
    asset.values.classifier = "sources";
    const form = buildUploadForm(definition, component, [asset]);
    expect(form.get("maven2.generate-pom")).toBe("true");
    expect(form.get("maven2.asset1.classifier")).toBe("sources");
    expect(form.get("maven2.asset1.extension")).toBe("jar");
  });

  it("preserves Swift named file parts and omits optional files", () => {
    const definition = spec("swift", false, [], [field("source-archive", "FILE"), field("source-archive-signature", "FILE", true), field("metadata-signature", "FILE", true)]);
    const asset = newUploadDraft(definition.assetFields);
    asset.files["source-archive"] = file("source.zip");
    expect([...buildUploadForm(definition, newUploadDraft([]), [asset]).keys()]).toEqual(["swift.source-archive"]);
  });

  it.each(["npm", "pypi", "helm", "go", "cargo", "pub", "apt", "alpine", "terraform"])("uses the unnumbered %s file field for single assets", (format) => {
    const definition = spec(format);
    const asset = newUploadDraft(definition.assetFields);
    asset.files.asset = file("package.zip");
    expect([...buildUploadForm(definition, newUploadDraft([]), [asset]).keys()]).toEqual([`${format}.asset`]);
  });

  it("nests single-file attributes under the file part", () => {
    const definition = spec("yum", false, [], [field("filename", "STRING"), field("asset", "FILE")]);
    const asset = newUploadDraft(definition.assetFields);
    asset.files.asset = file("package.rpm");
    asset.values.filename = "package.rpm";
    expect(buildUploadForm(definition, newUploadDraft([]), [asset]).get("yum.asset.filename")).toBe("package.rpm");
  });

  it("rejects missing coordinates, files and attributes before sending", () => {
    const definition = spec("maven2", true, [field("groupId", "STRING")], [field("asset", "FILE"), field("extension", "STRING")]);
    const component = newUploadDraft(definition.componentFields);
    const asset = newUploadDraft(definition.assetFields);
    expect(() => buildUploadForm(definition, component, [asset])).toThrow("groupId is required.");
    component.values.groupId = "org.example";
    expect(() => buildUploadForm(definition, component, [asset])).toThrow("asset is required.");
    asset.files.asset = file("demo.jar");
    expect(() => buildUploadForm(definition, component, [asset])).toThrow("extension is required.");
    expect(() => buildUploadForm(definition, component, [])).toThrow("At least one asset");
  });
});
