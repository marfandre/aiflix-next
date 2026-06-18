import type { ReactNode } from 'react';
import { noindexMetadata } from '@/lib/seoMetadata';

export const metadata = noindexMetadata('Edit Image');

export default function EditImageLayout({ children }: { children: ReactNode }) {
  return children;
}
