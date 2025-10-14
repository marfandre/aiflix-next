'use client';
import '@mux/mux-player';

type Props = {
  // поддержим разные названия пропсов на всякий случай
  playbackId?: string | null;
  playback_id?: string | null;
};

export default function VideoPlayer({ playbackId, playback_id }: Props) {
  const pid = playbackId ?? playback_id ?? '';

  return (
    <mux-player
      stream-type="on-demand"
      playback-id={pid}
      playsinline
      controls
      
      poster={pid ? `https://image.mux.com/${pid}/thumbnail.jpg?time=1&fit_mode=smartcrop&aspect_ratio=16:9&width=1200` : undefined}
      style={{ display: 'block', width: '100%', maxWidth: 900, aspectRatio: '16 / 9', margin: '0 auto' }}
    />
  );
}
