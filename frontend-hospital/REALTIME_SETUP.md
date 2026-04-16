## Realtime (Chat + Video Call) setup

### WebSocket / STOMP
- **Backend endpoint**: `GET ws(s)://<backend-host>/ws` (STOMP over WebSocket)
- **Frontend**: uses `@stomp/stompjs` with `reconnectDelay` enabled by default.

If you run backend on `http://localhost:8080`, the frontend will connect to `ws://localhost:8080/ws`.

### Video calling (WebRTC) — ICE (STUN/TURN)

WebRTC needs ICE servers to work reliably across NAT and mobile networks.

- **Dev (STUN only)**: usually OK for local testing.
- **Production**: you should provide a TURN server (e.g. coturn).

#### Frontend env var
Set `VITE_ICE_SERVERS_JSON` in `frontend-hospital/.env` as a JSON array of `RTCIceServer`:

```json
[
  { "urls": ["stun:stun.l.google.com:19302"] },
  { "urls": ["turn:turn.example.com:3478"], "username": "turnUser", "credential": "turnPass" }
]
```

#### TURN server (coturn) checklist
- **Ports**: open `3478/udp` and `3478/tcp` (and `5349` for TLS if used).
- **Auth**: use long-term credentials (username/password) or TURN REST auth.
- **NAT**: set external/public IP correctly on the TURN server.

### RabbitMQ STOMP relay (recommended for reliability)

The backend is configured to prefer a STOMP broker relay when `app.ws.relay.host` is set.

Set backend env/properties:
- `APP_WS_RELAY_ENABLED=true`
- `APP_WS_RELAY_HOST=<rabbitmq-host>`
- `APP_WS_RELAY_PORT=61613`
- `APP_WS_RELAY_CLIENT_LOGIN=<stomp-user>`
- `APP_WS_RELAY_CLIENT_PASSCODE=<stomp-pass>`
- `APP_WS_RELAY_SYSTEM_LOGIN=<stomp-user>`
- `APP_WS_RELAY_SYSTEM_PASSCODE=<stomp-pass>`

If relay host is not set, backend falls back to Spring’s in-memory simple broker (non-durable).

