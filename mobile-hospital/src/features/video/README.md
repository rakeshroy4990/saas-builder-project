# Video (Agora Web + STOMP)

- RTC: **WebView + agora-rtc-sdk-ng** (same as web `VideoRoomAdapter`) — no native `react-native-agora`
- Tokens: `POST /api/appointment/{id}/join-call`
- Signaling: STOMP `/user/queue/webrtc`
- UI: `VideoCallScreen.tsx`, `AgoraWebRoom.tsx`

Native `react-native-agora` was removed to keep preview APK size down (~150 MB saved).
