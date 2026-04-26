'use client';

import { useMemo } from 'react';

type Props = {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  ringClassName?: string;
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) - h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function isPlaceholder(src: string | null | undefined): boolean {
  if (!src) return true;
  if (src === '/placeholder.png') return true;
  if (src.endsWith('/placeholder.png')) return true;
  return false;
}

function getInitial(name: string | null | undefined): string {
  if (!name) return '?';
  const trimmed = name.replace(/^@/, '').trim();
  return (trimmed[0] ?? '?').toUpperCase();
}

function getBackground(name: string | null | undefined): string {
  const seed = (name && name.trim()) || 'anon';
  const hue = hash(seed) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

export default function Avatar({
  src,
  name,
  size = 32,
  className = '',
  ringClassName = '',
}: Props) {
  const placeholder = isPlaceholder(src);
  const initial = useMemo(() => getInitial(name), [name]);
  const background = useMemo(() => getBackground(name), [name]);

  if (!placeholder && src) {
    return (
      <img
        src={src}
        alt={name ?? ''}
        className={`rounded-full object-cover flex-shrink-0 ${ringClassName} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-label={name ?? undefined}
      className={`flex items-center justify-center rounded-full select-none text-white font-semibold flex-shrink-0 ${ringClassName} ${className}`}
      style={{
        width: size,
        height: size,
        background,
        fontSize: Math.max(10, Math.round(size * 0.42)),
        lineHeight: 1,
      }}
    >
      {initial}
    </div>
  );
}
