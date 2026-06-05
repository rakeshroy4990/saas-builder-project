import { toUserFacingApiError } from '../src/api/apiErrors';
import { useNetworkStore } from '../src/network/networkStore';

describe('toUserFacingApiError', () => {
  beforeEach(() => {
    useNetworkStore.setState({ isOffline: false });
  });

  it('returns offline message when network store reports offline', () => {
    useNetworkStore.setState({ isOffline: true });
    expect(toUserFacingApiError(new Error('ECONNREFUSED'), 'fallback')).toMatch(/offline/i);
  });

  it('maps abort to timeout guidance', () => {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    expect(toUserFacingApiError(err, 'fallback')).toMatch(/too long/i);
  });

  it('maps generic network failures', () => {
    expect(toUserFacingApiError(new Error('Network request failed'), 'fallback')).toMatch(
      /Unable to reach/
    );
  });
});
