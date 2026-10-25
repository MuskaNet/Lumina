export interface UploadField {
  name: string;
  type: "STRING" | "BOOLEAN" | "FILE";
  description: string;
  optional: boolean;
  group?: string | null;
}

export interface UploadSpec {
  format: string;
  multipleUpload: boolean;
  componentFields: UploadField[];
  assetFields: UploadField[];
}

export interface UploadDraft {
  values: Record<string, string | boolean>;
  files: Record<string, File | null>;
}

export function newUploadDraft(fields: UploadField[]): UploadDraft {
  return {
    values: Object.fromEntries(fields.filter((field) => field.type !== "FILE")
      .map((field) => [field.name, field.type === "BOOLEAN" ? false : ""])),
    files: Object.fromEntries(fields.filter((field) => field.type === "FILE")
      .map((field) => [field.name, null])),
  };
}

export function buildUploadForm(spec: UploadSpec, component: UploadDraft, assets: UploadDraft[]): FormData {
  const form = new FormData();
  function appendFields(fields: UploadField[], draft: UploadDraft, prefix: string, assetKey?: string) {
    for (const field of fields) {
      const key = field.type === "FILE"
        ? `${prefix}.${field.name === "asset" && assetKey ? assetKey : field.name}`
        : `${prefix}${assetKey ? `.${assetKey}` : ""}.${field.name}`;
      if (field.type === "FILE") {
        const file = draft.files[field.name];
        if (file) form.append(key, file);
        else if (!field.optional) throw new Error(`${field.description || field.name} is required.`);
      } else if (field.type === "BOOLEAN") {
        form.append(key, String(draft.values[field.name] === true));
      } else {
        const value = String(draft.values[field.name] ?? "").trim();
        if (!value && !field.optional) throw new Error(`${field.description || field.name} is required.`);
        if (value) form.append(key, value);
      }
    }
  }
  appendFields(spec.componentFields, component, spec.format);
  if (!assets.length) throw new Error("At least one asset is required.");
  assets.forEach((asset, index) => {
    const key = spec.multipleUpload ? `asset${index + 1}` : undefined;
    const fileFields = spec.assetFields.filter((field) => field.type === "FILE");
    // Asset attributes belong to the corresponding multipart file, not the component.
    const attributeKey = key ?? (fileFields.length === 1 ? fileFields[0]!.name : undefined);
    appendFields(spec.assetFields.filter((field) => field.type === "FILE"), asset, spec.format, key);
    appendFields(spec.assetFields.filter((field) => field.type !== "FILE"), asset, spec.format, attributeKey);
  });
  return form;
}
