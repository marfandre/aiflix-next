import type { Metadata } from 'next';
import ImageSeoLandingPage from '../../_components/ImageSeoLandingPage';
import { buildLandingMetadata, getAspectLanding } from '../../_lib/seoLanding';

type Props = { params: { aspect: string } };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return buildLandingMetadata(getAspectLanding(params.aspect));
}

export default function ImageAspectLandingPage({ params }: Props) {
  return <ImageSeoLandingPage config={getAspectLanding(params.aspect)} />;
}
