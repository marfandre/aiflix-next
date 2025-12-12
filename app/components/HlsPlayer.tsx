'use client';

import { useEffect, useRef } from 'react';

export default function HlsPlayer({ playbackId, poster }: { playbackId: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let hls: any;
    const run = async () => {
      const video = videoRef.current;
      if (!video || !playbackId) return;

      const src = `https://stream.mux.com/${playbackId}.m3u8`;

      // Native HLS?
      if (video.canPlayType('application/vnd.apple.mpegURL')) {
        video.src = src;
        return;
      }

      // hls.js для Chrome/Firefox/др.
      const Hls = (await import('hls.js')).default;
      if (Hls.isSupported()) {
        hls = new Hls({ maxBufferLength: 30 });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        // запасной вариант: mp4
        video.src = `https://stream.mux.com/${playbackId}/medium.mp4`;
      }
    };

    run();

    return () => {
      // аккуратно подчистим hls
      try {
        // @ts-ignore
        if (hls && hls.destroy) hls.destroy();
      } catch {}
    };
  }, [playbackId]);

  return (
    <video
      ref={videoRef}
      controls
      className="w-full h-full object-contain bg-black"
      poster={poster}
      preload="metadata"
    />
  );
}
