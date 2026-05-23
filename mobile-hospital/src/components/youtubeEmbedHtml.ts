/** Origin sent to YouTube as embed `origin` and WebView `baseUrl` (Referer). */
export function getYoutubeEmbedOrigin(): string {
  return 'https://com.agastya.healthcare';
}

/** Extract a bare 11-char id from URLs, Shorts paths, or raw ids. */
export function normalizeYoutubeVideoId(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  const shorts = value.match(/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shorts?.[1]) return shorts[1];
  const watch = value.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (watch?.[1]) return watch[1];
  const embed = value.match(/embed\/([a-zA-Z0-9_-]{11})/i);
  if (embed?.[1]) return embed[1];
  return null;
}

export function buildYoutubeEmbedHtml(videoId: string): string {
  const id = normalizeYoutubeVideoId(videoId);
  if (!id) return '';
  const origin = getYoutubeEmbedOrigin();
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(origin)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #0f172a; overflow: hidden; }
    .frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe
    class="frame"
    src="${src}"
    title="YouTube video"
    referrerpolicy="strict-origin-when-cross-origin"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
    allowfullscreen
  ></iframe>
</body>
</html>`;
}
