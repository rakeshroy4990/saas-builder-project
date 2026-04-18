# Package: `com.flexshell.realtime` (`chat`, `webrtc`, …)

## Role

**Hospital-specific hooks** on top of **`backend-realtime-lib`**: support agent selection, requester profile resolution for chat, and WebRTC call permission checks.

## Classes in this repo

- `realtime/chat/HospitalSupportRequesterProfileResolver`
- `realtime/chat/HospitalSupportAgentPicker`
- `realtime/webrtc/HospitalCallPermissionEvaluator`

## Notes

WebSocket/STOMP configuration and generic chat controllers live in the **realtime library**, not duplicated here. When debugging chat or video, check both this package and `backend-realtime-lib`.

---

*Last updated: 2026-04-18*
