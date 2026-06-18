import type { Metadata } from 'next';
import ImageSeoLandingPage from '../../_components/ImageSeoLandingPage';
import { buildLandingMetadata, getTagLanding } from '../../_lib/seoLanding';

type Props = { params: { tag: string } };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return buildLandingMetadata(getTagLanding(params.tag));
}

export default function ImageTagLandingPage({ params }: Props) {
  return <ImageSeoLandingPage config={getTagLanding(params.tag)} />;
}
