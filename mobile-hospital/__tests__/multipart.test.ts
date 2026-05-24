import { applyMultipartHeaders, normalizeUploadMimeType } from '../src/api/multipart';

describe('normalizeUploadMimeType', () => {
  it('maps octet-stream from filename', () => {
    expect(normalizeUploadMimeType('rx.pdf', 'application/octet-stream')).toBe('application/pdf');
    expect(normalizeUploadMimeType('scan.JPG', '')).toBe('image/jpeg');
  });

  it('keeps declared mime when specific', () => {
    expect(normalizeUploadMimeType('x.bin', 'image/png')).toBe('image/png');
  });
});

describe('applyMultipartHeaders', () => {
  it('removes Content-Type for FormData', () => {
    const form = new FormData();
    const config = applyMultipartHeaders({
      data: form,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
    } as Parameters<typeof applyMultipartHeaders>[0]);
    expect((config.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect((config.headers as Record<string, string>)['content-type']).toBeUndefined();
    expect((config.headers as Record<string, string>).Accept).toBe('application/json');
  });
});
