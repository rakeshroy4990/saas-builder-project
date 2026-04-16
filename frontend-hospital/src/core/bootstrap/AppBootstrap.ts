import { ComponentRegistry } from '../registry/ComponentRegistry';
import { registerTheme } from '../theme/registerTheme';
import { registerHospitalModule } from '../../modules/HospitalModule';
import DynamicContainer from '../../components/renderer/DynamicContainer.vue';
import DynButton from '../../components/primitives/DynButton.vue';
import DynText from '../../components/primitives/DynText.vue';
import DynInput from '../../components/primitives/DynInput.vue';
import DynDropdown from '../../components/primitives/DynDropdown.vue';
import DynList from '../../components/primitives/DynList.vue';
import DynImage from '../../components/primitives/DynImage.vue';
import DynCheckbox from '../../components/primitives/DynCheckbox.vue';
import DynRadioGroup from '../../components/primitives/DynRadioGroup.vue';
import DynChat from '@realtime/components/DynChat.vue';
import DynVideoCall from '@realtime/components/DynVideoCall.vue';

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
  ComponentRegistry.register('chat', DynChat);
  ComponentRegistry.register('video-call', DynVideoCall);

  registerHospitalModule();
}
