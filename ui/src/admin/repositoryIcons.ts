/**
 * The format/type icon helpers moved to `shared/formatIcons.ts` so the browse
 * console can render the same marks. This module stays as the admin-console
 * entry point for the existing imports.
 */
export {
  FORMAT_ICON_NAMES,
  formatIconName,
  formatLogoClass,
  TYPE_ICON_NAMES,
  typeIconName,
} from "../shared/formatIcons";
