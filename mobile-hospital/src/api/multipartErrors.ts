import { toUserFacingApiError } from '@/api/apiErrors';

export function mapMultipartFetchError(err: unknown): Error {
  return new Error(toUserFacingApiError(err, 'Upload failed. Please try again.'));
}
