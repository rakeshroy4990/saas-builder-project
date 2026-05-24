import { copyAsync } from 'expo-file-system/legacy';

import { ensureUploadableFileUri } from '../src/api/ensureUploadableUri';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/cache/',
  copyAsync: jest.fn()
}));

describe('ensureUploadableFileUri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns file:// URIs unchanged', async () => {
    const uri = 'file:///tmp/rx.jpg';
    await expect(ensureUploadableFileUri(uri, 'rx.jpg')).resolves.toBe(uri);
    expect(copyAsync).not.toHaveBeenCalled();
  });

  it('copies content:// URIs into cache', async () => {
    await ensureUploadableFileUri('content://media/1', 'scan.jpg');
    expect(copyAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'content://media/1',
        to: expect.stringContaining('/cache/rx-upload-')
      })
    );
  });
});
