import type { DetailedHTMLProps, HTMLAttributes } from 'react';
export {}; // make this a module

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'mux-player': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        playbackId?: string;
        'playback-id'?: string;
        streamType?: 'on-demand' | 'live' | 'll-live';
        'stream-type'?: 'on-demand' | 'live' | 'll-live';
        playsinline?: boolean;
        autoplay?: boolean;
        muted?: boolean;
        controls?: boolean;
        poster?: string;
        style?: any;
      };
    }
  }
}
