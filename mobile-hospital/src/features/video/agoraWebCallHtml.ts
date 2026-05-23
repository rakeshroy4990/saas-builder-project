/** Inline Agora Web RTC page (agora-rtc-sdk-ng) — same stack as web VideoRoomAdapter. */
export const AGORA_WEB_SDK_URL =
  'https://cdn.jsdelivr.net/npm/agora-rtc-sdk-ng@4.23.4/AgoraRTC_N.js';

export function buildAgoraWebCallHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #1e293b; overflow: hidden; }
    #remote { width: 100%; height: 100%; background: #1e293b; }
    #local {
      position: fixed; right: 12px; bottom: 12px; width: 120px; height: 160px;
      border-radius: 8px; overflow: hidden; background: #0f172a; z-index: 2;
    }
  </style>
</head>
<body>
  <div id="remote"></div>
  <div id="local"></div>
  <script src="${AGORA_WEB_SDK_URL}"></script>
  <script>
    (function () {
      var client = null;
      var localAudio = null;
      var localVideo = null;
      var cameraDevices = [];
      var cameraIndex = 0;

      function post(type, payload) {
        var body = JSON.stringify(Object.assign({ type: type }, payload || {}));
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(body);
        }
      }

      function parseMsg(raw) {
        try {
          return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) {
          return null;
        }
      }

      async function leaveCall() {
        try { if (localAudio) { localAudio.close(); } } catch (e) {}
        try { if (localVideo) { localVideo.close(); } } catch (e) {}
        localAudio = null;
        localVideo = null;
        try { if (client) { await client.leave(); } } catch (e) {}
        client = null;
        var remote = document.getElementById('remote');
        var local = document.getElementById('local');
        if (remote) remote.innerHTML = '';
        if (local) local.innerHTML = '';
      }

      async function joinCall(cfg) {
        await leaveCall();
        if (!window.AgoraRTC) {
          post('error', { message: 'Agora Web SDK failed to load' });
          return;
        }
        client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        client.on('user-published', async function (user, mediaType) {
          try {
            await client.subscribe(user, mediaType);
            if (mediaType === 'video' && user.videoTrack) {
              user.videoTrack.play(document.getElementById('remote'));
              post('remoteJoined', { uid: user.uid });
            }
            if (mediaType === 'audio' && user.audioTrack) {
              user.audioTrack.play();
            }
          } catch (e) {
            post('error', { message: 'Subscribe failed' });
          }
        });
        client.on('user-unpublished', function (user) {
          post('remoteLeft', { uid: user.uid });
        });
        client.on('token-privilege-will-expire', function () {
          post('tokenWillExpire', {});
        });
        await client.join(String(cfg.appId), String(cfg.channel), String(cfg.token), Number(cfg.uid));
        var tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        localAudio = tracks[0];
        localVideo = tracks[1];
        localVideo.play(document.getElementById('local'));
        await client.publish(tracks);
        try {
          cameraDevices = await AgoraRTC.getCameras();
        } catch (e) {
          cameraDevices = [];
        }
        post('joined', {});
      }

      async function handleCommand(msg) {
        if (!msg || !msg.command) return;
        switch (msg.command) {
          case 'join':
            try {
              await joinCall(msg);
            } catch (e) {
              post('error', { message: (e && e.message) || 'Join failed' });
            }
            break;
          case 'leave':
            await leaveCall();
            post('left', {});
            break;
          case 'setMic':
            if (localAudio) localAudio.setEnabled(Boolean(msg.enabled));
            break;
          case 'setCam':
            if (localVideo) localVideo.setEnabled(Boolean(msg.enabled));
            break;
          case 'renewToken':
            if (client && msg.token) await client.renewToken(String(msg.token));
            break;
          case 'switchCamera':
            if (!localVideo || !cameraDevices.length) break;
            cameraIndex = (cameraIndex + 1) % cameraDevices.length;
            try {
              await localVideo.setDevice(cameraDevices[cameraIndex].deviceId);
            } catch (e) {}
            break;
          default:
            break;
        }
      }

      function onMessage(event) {
        var msg = parseMsg(event.data);
        if (msg) void handleCommand(msg);
      }

      document.addEventListener('message', onMessage);
      window.addEventListener('message', onMessage);
      post('ready', {});
    })();
  </script>
</body>
</html>`;
}
