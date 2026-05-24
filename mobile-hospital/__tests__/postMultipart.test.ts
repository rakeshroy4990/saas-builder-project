import { mapMultipartFetchError } from '../src/api/multipartErrors';

describe('mapMultipartFetchError', () => {
  it('maps axios-style network errors to a clearer message', () => {
    const err = mapMultipartFetchError(new Error('Network Error'));
    expect(err.message).toContain('Could not reach the server');
  });

  it('maps abort to timeout guidance', () => {
    const aborted = new Error('Aborted');
    aborted.name = 'AbortError';
    const err = mapMultipartFetchError(aborted);
    expect(err.message).toContain('timed out');
  });

  it('preserves server error messages', () => {
    const err = mapMultipartFetchError(new Error('Prescription transcription is restricted to doctors.'));
    expect(err.message).toBe('Prescription transcription is restricted to doctors.');
  });
});
