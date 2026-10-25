export type FieldType =
  | "text"
  | "password"
  | "number"
  | "url"
  | "email"
  | "textarea"
  | "checkbox"
  | "select"
  | "datetime-local"
  | "list";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Section heading rendered once before the first field of that section. */
  group?: string;
  options?: FieldOption[];
  placeholder?: string;
  help?: string;
  required?: boolean;
  min?: number;
  max?: number;
  readOnly?: boolean;
  /** Hides the field when it returns false. */
  showWhen?: (model: Record<string, unknown>) => boolean;
  /** Whether the field should span the full width of the form grid. */
  wide?: boolean;
  /** For `list` fields: how raw input is split. */
  listSeparator?: "newline" | "comma";
}
