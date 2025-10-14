'use client';
import '@mux/mux-player';

type Props = { playbackId: string };

export default function VideoPlayer({ playbackId }: Props) {
  return (
    <mux-player
      stream-type="on-demand"
      playback-id={playbackId}
      playsinline
      controls
      poster={`https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&fit_mode=smartcrop&aspect_ratio=16:9&width=1200`}
      style={{ width: '100%', aspectRatio: '16 / 9' }}
    />
  );
}
