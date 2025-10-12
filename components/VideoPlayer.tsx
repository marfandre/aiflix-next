type Props = { playbackId: string };

export default function VideoPlayer({ playbackId }: Props) {
  return (
    <mux-player
      stream-type="on-demand"
      playback-id={playbackId}
      playsinline
      style={{ width: '100%', height: '100%' }}
    />
  );
}


