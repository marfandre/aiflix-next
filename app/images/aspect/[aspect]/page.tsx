import type { Metadata } from 'next';
import ImageSeoLandingPage from '../../_components/ImageSeoLandingPage';
import { buildLandingMetadata, getAspectLanding, hasIndexableLandingImages } from '../../_lib/seoLanding';

type Props = { params: { aspect: string } };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = getAspectLanding(params.aspect);
  return buildLandingMetadata(config, await hasIndexableLandingImages(config));
}

export default function ImageAspectLandingPage({ params }: Props) {
  return <ImageSeoLandingPage config={getAspectLanding(params.aspect)} />;
}
