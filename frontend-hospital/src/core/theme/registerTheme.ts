import { registerLayoutTemplates } from './registerLayoutTemplates';
import { registerStyleTemplates } from './registerStyleTemplates';

/** Register all layout and style templates (call once at app bootstrap). */
export function registerTheme(): void {
  registerLayoutTemplates();
  registerStyleTemplates();
}
