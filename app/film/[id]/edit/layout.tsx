import type { ReactNode } from 'react';
import { noindexMetadata } from '@/lib/seoMetadata';

export const metadata = noindexMetadata('Edit Video');

export default function EditVideoLayout({ children }: { children: ReactNode }) {
  return children;
}
