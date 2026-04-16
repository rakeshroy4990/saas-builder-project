/**
 * Visual styles resolved via StyleTemplateRegistry template names.
 * In page/config JSON, prefer `styleTemplate` / `styleTemplates` only; concrete
 * utility strings live in theme registration (`registerStyleTemplates`).
 */
export interface StyleConfig {
  /** Single named template from the registry. */
  styleTemplate?: string;
  /** Compose multiple named templates (earlier entries first). */
  styleTemplates?: string[];
  /**
   * Space-separated utility classes — **registry-only** when building themes;
   * configs should not set this directly.
   */
  utilityClasses?: string;
  size?: { width?: string; height?: string };
  spacing?: { padding?: string; margin?: string };
  typography?: { fontSize?: string; fontWeight?: string; color?: string };
  background?: { color?: string };
  border?: { radius?: string; width?: string; color?: string };
  display?: { overflow?: string; position?: string; objectFit?: string };
}
