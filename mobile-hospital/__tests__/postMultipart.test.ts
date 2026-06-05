import { mapMultipartFetchError } from '../src/api/multipartErrors';

describe('mapMultipartFetchError', () => {
  it('maps axios-style network errors to a clearer message', () => {
    const err = mapMultipartFetchError(new Error('Network Error'));
    expect(err.message).toMatch(/Unable to reach the server/i);
  });

  it('maps abort to timeout guidance', () => {
    const aborted = new Error('Aborted');
    aborted.name = 'AbortError';
    const err = mapMultipartFetchError(aborted);
    expect(err.message).toMatch(/too long to respond/i);
  });

  it('preserves server error messages', () => {
    const err = mapMultipartFetchError(new Error('Prescription transcription is restricted to doctors.'));
    expect(err.message).toBe('Prescription transcription is restricted to doctors.');
  });
});
