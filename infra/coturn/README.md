# Coturn (TURN/STUN) for WebRTC

Used by the hospital app via `VITE_ICE_SERVERS_JSON` (see `frontend-hospital/.env`).

## Start

```bash
cd infra/coturn
docker compose up -d
docker compose logs -f coturn
```

## Credentials (development)

- **Username:** `webrtc`
- **Password:** `changeme` (set in `turnserver.conf` as `user=webrtc:changeme`)

Change these before any shared or production deployment.

## Browser URL for `turn:`

| Scenario | Use in `VITE_ICE_SERVERS_JSON` |
|----------|--------------------------------|
| Two tabs on the same machine (Docker on that machine) | `turn:127.0.0.1:3478` |
| Phone / another PC on the same LAN | `turn:<this-computer-LAN-IP>:3478` (e.g. `turn:192.168.1.10:3478`) |

If relay fails from another device, uncomment `external-ip` in `turnserver.conf` and set it to that same LAN IP, then `docker compose restart`.

## Stop

```bash
docker compose down
```
