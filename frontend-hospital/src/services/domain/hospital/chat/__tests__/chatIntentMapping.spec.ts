import { describe, expect, it } from 'vitest';
import { detectChatFeatureIntent, isGuidedFlowCancelMessage } from '../chatIntentMapping';

describe('chatIntentMapping', () => {
  it('detects book appointment phrases', () => {
    expect(detectChatFeatureIntent('I want to set an appointment')).toBe('book_appointment');
    expect(detectChatFeatureIntent('book appointment please')).toBe('book_appointment');
  });

  it('detects availability phrases', () => {
    expect(detectChatFeatureIntent('check availability of a doctor')).toBe('check_availability');
    expect(detectChatFeatureIntent('when is Dr Sharma available')).toBe('check_availability');
  });

  it('prioritizes video call over book appointment', () => {
    expect(detectChatFeatureIntent('I want to video call a doctor for appointment')).toBe('video_call');
  });

  it('returns null for symptom prompts', () => {
    expect(detectChatFeatureIntent('I have fever for 2 days')).toBeNull();
  });

  it('detects cancel phrases', () => {
    expect(isGuidedFlowCancelMessage('cancel')).toBe(true);
    expect(isGuidedFlowCancelMessage('never mind')).toBe(true);
  });
});
