// components/VideoPlayer.tsx
'use client';

import MuxPlayer from '@mux/mux-player-react';

export default function VideoPlayer({ playbackId }: { playbackId: string }) {
  if (!playbackId) return <div>Нет playback_id</div>;

  return (
    <MuxPlayer
      style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}
      playbackId={playbackId}
      streamType="on-demand"
      autoPlay={false}
      muted={false}
    />
  );
}


