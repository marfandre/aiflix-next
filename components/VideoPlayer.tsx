'use client';
import '@mux/mux-player';

type Props = {
  playbackId: string;
  /** Если это превью в каталоге — включи true, плеер будет немым и без контролов */
  preview?: boolean;
};

export default function VideoPlayer({ playbackId, preview }: Props) {
  return (
    <mux-player
      stream-type="on-demand"
      playback-id={playbackId}
      playsinline
      /* для превью — автоплей/луп/без контролов; иначе показываем нормальные контролы */
      {...(preview
        ? { autoplay: true, muted: true, loop: true, controls: false }
        : { controls: true })}
      /* КЛЮЧЕВОЕ: постер, чтобы не было чёрной плашки */
      poster={`https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&fit_mode=smartcrop&aspect_ratio=16:9&width=800`}
      style={{ width: '100%', aspectRatio: '16 / 9' }}
    />
  );
}
