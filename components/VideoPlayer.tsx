
'use client';

import MuxPlayer from '@mux/mux-player-react';

type Props = {
  playbackId: string;
  title?: string;
};

export default function VideoPlayer({ playbackId, title }: Props) {
  if (!playbackId) return null;

  return (
    <MuxPlayer
      streamType="on-demand"
      playbackId={playbackId}
      title={title}
      controls
      autoPlay={false}
      // красиво и безопасно (адаптивное видео):
      style={{ width: '100%', maxWidth: 900, aspectRatio: '16 / 9', borderRadius: 12 }}
    />
  );
}
