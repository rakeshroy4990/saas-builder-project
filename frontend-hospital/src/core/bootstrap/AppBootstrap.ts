import { defineAsyncComponent } from 'vue';
import { ComponentRegistry } from '../registry/ComponentRegistry';
import { registerTheme } from '../theme/registerTheme';
import { registerHospitalModule } from '../../modules/HospitalModule';
import DynamicContainer from '../../components/renderer/DynamicContainer.vue';
import DynButton from '../../components/primitives/DynButton.vue';
import DynText from '../../components/primitives/DynText.vue';
import DynInput from '../../components/primitives/DynInput.vue';
import DynDatePicker from '../../components/primitives/DynDatePicker.vue';
import DynDropdown from '../../components/primitives/DynDropdown.vue';
import DynList from '../../components/primitives/DynList.vue';
import DynImage from '../../components/primitives/DynImage.vue';
import DynYouTubeEmbed from '../../components/primitives/DynYouTubeEmbed.vue';
import DynCheckbox from '../../components/primitives/DynCheckbox.vue';
import DynRadioGroup from '../../components/primitives/DynRadioGroup.vue';
import DynDoctorScheduleEditor from '../../components/primitives/DynDoctorScheduleEditor.vue';
import DynMedicineListEditor from '../../components/primitives/DynMedicineListEditor.vue';
import DynDoctorEducationWorkspace from '../../components/primitives/DynDoctorEducationWorkspace.vue';
import DynEducationAttachmentSequence from '../../components/primitives/DynEducationAttachmentSequence.vue';
import DynPrescriptionUpload from '../../components/primitives/DynPrescriptionUpload.vue';
import DynPrescriptionList from '../../components/primitives/DynPrescriptionList.vue';
import DynLanguageSwitcher from '../../components/primitives/DynLanguageSwitcher.vue';
import DynNotificationBell from '../../components/primitives/DynNotificationBell.vue';
import DynDoctorValidatePrescriptionPanel from '../../components/primitives/DynDoctorValidatePrescriptionPanel.vue';
import DynDoctorRecommendedDosagePanel from '../../components/primitives/DynDoctorRecommendedDosagePanel.vue';
import DynTriageWizard from '../../components/primitives/DynTriageWizard.vue';
import DynTriageResultBadge from '../../components/primitives/DynTriageResultBadge.vue';
import DynAnalyticsWorkspace from '../../components/primitives/DynAnalyticsWorkspace.vue';
import DynAiConversationWorkspace from '../../components/primitives/DynAiConversationWorkspace.vue';

/** STOMP + chat UI — not needed for first paint. */
const DynChat = defineAsyncComponent(() => import('@realtime/components/DynChat.vue'));
/** Pulls `agora-rtc-sdk-ng` (~1.5MB) only when video call UI is first used. */
const DynVideoCall = defineAsyncComponent(() => import('@realtime/components/DynVideoCall.vue'));
const DynGrowthWorkspace = defineAsyncComponent(
  () => import('../../components/primitives/DynGrowthWorkspace.vue')
);
const DynBluetoothDevicesHost = defineAsyncComponent(
  () => import('../../components/primitives/DynBluetoothDevicesHost.vue')
);
const DynSmartWatchIntegration = defineAsyncComponent(
  () => import('../../components/primitives/DynSmartWatchIntegration.vue')
);
const DynAppointmentGrowthForm = defineAsyncComponent(
  () => import('../../components/primitives/DynAppointmentGrowthForm.vue')
);

export function bootstrap(): void {
  registerTheme();

  ComponentRegistry.register('button', DynButton);
  ComponentRegistry.register('text', DynText);
  ComponentRegistry.register('language-switcher', DynLanguageSwitcher);
  ComponentRegistry.register('notification-bell', DynNotificationBell);
  ComponentRegistry.register('input', DynInput);
  ComponentRegistry.register('date-picker', DynDatePicker);
  ComponentRegistry.register('dropdown', DynDropdown);
  ComponentRegistry.register('list', DynList);
  ComponentRegistry.register('container', DynamicContainer);
  ComponentRegistry.register('image', DynImage);
  ComponentRegistry.register('youtube-embed', DynYouTubeEmbed);
  ComponentRegistry.register('checkbox', DynCheckbox);
  ComponentRegistry.register('radio-group', DynRadioGroup);
  ComponentRegistry.register('chat', DynChat);
  ComponentRegistry.register('video-call', DynVideoCall);
  ComponentRegistry.register('bluetooth-devices', DynBluetoothDevicesHost);
  ComponentRegistry.register('smart-watch-integration', DynSmartWatchIntegration);
  ComponentRegistry.register('growth-workspace', DynGrowthWorkspace);
  ComponentRegistry.register('analytics-workspace', DynAnalyticsWorkspace);
  ComponentRegistry.register('appointment-growth-form', DynAppointmentGrowthForm);
  ComponentRegistry.register('doctor-schedule-editor', DynDoctorScheduleEditor);
  ComponentRegistry.register('medicine-list-editor', DynMedicineListEditor);
  ComponentRegistry.register('doctor-education-workspace', DynDoctorEducationWorkspace);
  ComponentRegistry.register('education-attachment-sequence', DynEducationAttachmentSequence);
  ComponentRegistry.register('prescription-upload', DynPrescriptionUpload);
  ComponentRegistry.register('prescription-list', DynPrescriptionList);
  ComponentRegistry.register('triage-wizard', DynTriageWizard);
  ComponentRegistry.register('triage-result-badge', DynTriageResultBadge);
  ComponentRegistry.register('doctor-validate-prescription', DynDoctorValidatePrescriptionPanel);
  ComponentRegistry.register('doctor-recommended-dosage', DynDoctorRecommendedDosagePanel);
  ComponentRegistry.register('ai-conversation-workspace', DynAiConversationWorkspace);

  registerHospitalModule();
}
