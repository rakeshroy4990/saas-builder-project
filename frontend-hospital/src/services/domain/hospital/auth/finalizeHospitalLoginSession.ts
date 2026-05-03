import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import {
  applyAccessExpiryHintFromAuthPayload,
  getAuthTokenExpiresAtMs,
  parseJwtSubject
} from '../../../auth/authToken';
import { setEphemeralRefreshToken } from '../../../auth/refreshTokenEphemeral';
import { persistAuthSessionProfile } from '../../../auth/authSessionStore';
import { pickString } from '../shared/strings';
import { buildFriendlyDisplayName } from '../shared/displayName';
import { ensureHospitalWebRtcInboundConnected } from '../shared/hospitalWebRtcInbound';
import { ensureHospitalAdminSupportInboxReady } from '../chat/chatServices';
import { trackEvent } from '../../../analytics/firebaseAnalytics';
import { emitSessionSummaryAuthLogin } from '../../../analytics/sessionSummary';
import { mintLoginSessionId } from '../../../logging/loginSessionContext';
import { getOrCreateTraceId, startNewTraceId } from '../../../logging/traceContext';
import { refreshHeroYoutubeFromUserQueryCache } from '../home/resolveHeroYoutubeVideoService';

/**
 * Applies login API payload to Pinia, persistence, and post-login side effects (WebRTC, admin inbox).
 */
export async function finalizeHospitalLoginSession(
  userData: Record<string, unknown>,
  identityFallback: string,
  options?: { authMethod?: 'password' | 'google' }
): Promise<void> {
  const accessToken =
    pickString(userData, ['accessToken', 'AccessToken', 'token', 'Token']) || '';
  const refreshFromBody = pickString(userData, ['refreshToken', 'RefreshToken']);
  setEphemeralRefreshToken(refreshFromBody || null);
  applyAccessExpiryHintFromAuthPayload(userData as Record<string, unknown>);
  if (getAuthTokenExpiresAtMs() == null) {
    applyAccessExpiryHintFromAuthPayload({ expiresInSeconds: 900 });
  }
  const canonicalUserId =
    pickString(userData, ['UserId', 'userId']) ||
    (accessToken ? parseJwtSubject(accessToken) : '') ||
    identityFallback;
  const resolvedEmail = pickString(userData, ['Email', 'email']) || String(identityFallback ?? '').trim();
  let displayName = buildFriendlyDisplayName(userData, identityFallback).trim();
  if (!displayName) {
    const uname = pickString(userData, ['Username', 'username']).trim();
    displayName = uname && !uname.includes('@') ? uname : buildFriendlyDisplayName({}, resolvedEmail).trim();
  }
  if (!displayName) {
    displayName = 'User';
  }
  const firstName = pickString(userData, ['FirstName', 'firstName']);
  const lastName = pickString(userData, ['LastName', 'lastName']);
  const fullNameFromNames = [firstName, lastName].filter(Boolean).join(' ').trim();
  const fullName = fullNameFromNames || displayName;
  const resolvedMobileNumber = pickString(userData, ['MobileNumber', 'mobileNumber']);
  const resolvedAddress = pickString(userData, ['Address', 'address']);
  const resolvedGender = pickString(userData, ['Gender', 'gender']);
  const resolvedDepartment = pickString(userData, ['Department', 'department']);
  const resolvedQualifications = pickString(userData, [
    'Qualifications',
    'Qualification',
    'qualifications',
    'qualification'
  ]);
  const resolvedSmcName = pickString(userData, ['SmcName', 'smcName', 'StateMedicalCouncil', 'stateMedicalCouncil']);
  const resolvedSmcRegistrationNumber = pickString(userData, [
    'SmcRegistrationNumber',
    'smcRegistrationNumber',
    'RegistrationNumber',
    'registrationNumber'
  ]);
  const resolvedRole = pickString(userData, ['Role', 'role']).toUpperCase() || 'PATIENT';
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userId', canonicalUserId);
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userDisplayName', displayName);
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'email', resolvedEmail);
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'mobileNumber', resolvedMobileNumber);
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'address', resolvedAddress);
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'gender', resolvedGender);
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'department', resolvedDepartment);
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'qualifications', resolvedQualifications);
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'smcName', resolvedSmcName);
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'smcRegistrationNumber', resolvedSmcRegistrationNumber);
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'fullName', fullName);
  useAppStore(pinia).setProperty('hospital', 'AuthSession', 'role', resolvedRole);
  persistAuthSessionProfile({
    userId: canonicalUserId,
    userDisplayName: displayName,
    fullName,
    loginDisplayName: displayName,
    email: resolvedEmail,
    mobileNumber: resolvedMobileNumber,
    address: resolvedAddress,
    gender: resolvedGender,
    department: resolvedDepartment,
    qualifications: resolvedQualifications,
    smcName: resolvedSmcName,
    smcRegistrationNumber: resolvedSmcRegistrationNumber,
    role: resolvedRole
  });
  mintLoginSessionId();
  startNewTraceId();
  useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
  useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
  useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
  try {
    await ensureHospitalWebRtcInboundConnected();
  } catch {
    // Non-fatal: inbound video signals still work after opening dashboard / video popup.
  }
  if (resolvedRole === 'ADMIN') {
    try {
      await ensureHospitalAdminSupportInboxReady();
    } catch {
      // Non-fatal: badge/chat still work after opening the chat popup.
    }
  }
  trackEvent('login_success', {
    role: resolvedRole,
    domain: 'auth',
    status: 'success',
    trace_id: getOrCreateTraceId()
  });
  emitSessionSummaryAuthLogin(options?.authMethod === 'google' ? 'google' : 'password');
  void refreshHeroYoutubeFromUserQueryCache();
}
