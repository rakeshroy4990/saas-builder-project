import {
  buildYoutubeEmbedHtml,
  normalizeYoutubeVideoId
} from '../src/components/youtubeEmbedHtml';

describe('youtube embed helpers', () => {
  it('normalizes bare and URL video ids', () => {
    expect(normalizeYoutubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(normalizeYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(normalizeYoutubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('builds nocookie embed html with origin', () => {
    const html = buildYoutubeEmbedHtml('dQw4w9WgXcQ');
    expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(html).toContain('origin=https%3A%2F%2Fcom.agastya.healthcare');
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
  });
});
