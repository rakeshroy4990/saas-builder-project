import { describe, expect, it } from 'vitest';
import {
  shouldSkipButtonClickSessionSummary,
  shortenTelemetryComponentId
} from './shouldSkipButtonClickSessionSummary';

describe('shouldSkipButtonClickSessionSummary', () => {
  it('skips header menu chrome and logout', () => {
    expect(
      shouldSkipButtonClickSessionSummary(
        { actionId: 'toggle-profile-header-menu' },
        { component_id: 'hospital-home-page--hospital-public-header-user-menu' }
      )
    ).toBe(true);
    expect(
      shouldSkipButtonClickSessionSummary(
        { actionId: 'logout-user' },
        { component_id: 'hospital-public-header-user-menu-logout' }
      )
    ).toBe(true);
  });

  it('keeps non-header actions', () => {
    expect(
      shouldSkipButtonClickSessionSummary(
        { actionId: 'submit-doctor-education-conversation' },
        { component_id: 'hospital-doctor-education-send' }
      )
    ).toBe(false);
  });
});

describe('shortenTelemetryComponentId', () => {
  it('uses leaf segment for header paths', () => {
    expect(
      shortenTelemetryComponentId(
        'hospital-home-page--hospital-public-header--hospital-public-header-user-menu-logout'
      )
    ).toBe('hospital-public-header-user-menu-logout');
  });
});
