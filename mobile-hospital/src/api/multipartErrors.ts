export function mapMultipartFetchError(err: unknown): Error {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return new Error('Upload timed out. Try a smaller image or check your connection.');
    }
    const msg = err.message.trim();
    if (!msg || /^network error$/i.test(msg) || /network request failed/i.test(msg)) {
      return new Error('Could not reach the server. Check your internet connection and try again.');
    }
    return err;
  }
  return new Error('Upload failed');
}
