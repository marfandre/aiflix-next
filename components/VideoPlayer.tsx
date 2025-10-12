'use client';

import MuxPlayer from '@mux/mux-player-react';

type Props = { playbackId: string };

export default function VideoPlayer({ playbackId }: Props) {
  return (
    <MuxPlayer
      streamType="on-demand"
      playbackId={playbackId}
      playsInline
      // Если нужен автоплей:
      // autoPlay
      // muted
      style={{ width: '100%', aspectRatio: '16 / 9' }}
    />
  );
}
