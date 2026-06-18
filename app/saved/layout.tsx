import type { ReactNode } from 'react';
import { noindexMetadata } from '@/lib/seoMetadata';

export const metadata = noindexMetadata('Saved');

export default function SavedLayout({ children }: { children: ReactNode }) {
  return children;
}
