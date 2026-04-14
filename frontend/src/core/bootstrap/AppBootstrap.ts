import { ComponentRegistry } from '../registry/ComponentRegistry';
import { registerTheme } from '../theme/registerTheme';
import { registerEcommerceModule } from '../../modules/EcommerceModule';
import { registerHospitalModule } from '../../modules/HospitalModule';
import { registerSocialModule } from '../../modules/SocialModule';
import DynamicContainer from '../../components/renderer/DynamicContainer.vue';
import DynButton from '../../components/primitives/DynButton.vue';
import DynText from '../../components/primitives/DynText.vue';
import DynInput from '../../components/primitives/DynInput.vue';
import DynDropdown from '../../components/primitives/DynDropdown.vue';
import DynList from '../../components/primitives/DynList.vue';
import DynImage from '../../components/primitives/DynImage.vue';
import DynCheckbox from '../../components/primitives/DynCheckbox.vue';
import DynRadioGroup from '../../components/primitives/DynRadioGroup.vue';

export function bootstrap(): void {
  registerTheme();

  ComponentRegistry.register('button', DynButton);
  ComponentRegistry.register('text', DynText);
  ComponentRegistry.register('input', DynInput);
  ComponentRegistry.register('dropdown', DynDropdown);
  ComponentRegistry.register('list', DynList);
  ComponentRegistry.register('container', DynamicContainer);
  ComponentRegistry.register('image', DynImage);
  ComponentRegistry.register('checkbox', DynCheckbox);
  ComponentRegistry.register('radio-group', DynRadioGroup);

  const activeModule = import.meta.env.VITE_DEFAULT_package ?? 'ecommerce';
  if (activeModule === 'ecommerce') registerEcommerceModule();
  if (activeModule === 'hospital') registerHospitalModule();
  if (activeModule === 'social') registerSocialModule();
}
