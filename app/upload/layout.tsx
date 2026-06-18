import type { ReactNode } from 'react';
import { noindexMetadata } from '@/lib/seoMetadata';

export const metadata = noindexMetadata('Upload');

export default function UploadLayout({ children }: { children: ReactNode }) {
  return children;
}
