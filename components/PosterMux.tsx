'use client';
import '@mux/mux-player';

type Props = {
  playbackId: string;
  /** Для карточек: немой автоплей, без контролов */
  preview?: boolean;
};

export default function PosterMux({ playbackId, preview = true }: Props) {
  return (
    <mux-player
      stream-type="on-demand"
      playback-id={playbackId}
      playsinline
      {...(preview
        ? { autoplay: true, muted: true, loop: true, controls: false }
        : { controls: true })}
      poster={`https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&fit_mode=smartcrop&aspect_ratio=16:9&width=800`}
      style={{ display: 'block', width: '100%', aspectRatio: '16 / 9' }}
    />
  );
}
