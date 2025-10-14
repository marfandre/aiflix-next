'use client';
import '@mux/mux-player';

export default function VideoPlayer({ playbackId }: { playbackId: string }) {
  return (
    <mux-player
      stream-type="on-demand"
      playback-id={playbackId}
      playsinline
      controls
      poster={`https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&fit_mode=smartcrop&aspect_ratio=16:9&width=1200`}
      style={{ display: 'block', width: '100%', maxWidth: 900, aspectRatio: '16 / 9', margin: '0 auto' }}
    />
  );
}
