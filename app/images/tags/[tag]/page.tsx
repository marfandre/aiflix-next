import type { Metadata } from 'next';
import ImageSeoLandingPage from '../../_components/ImageSeoLandingPage';
import { buildLandingMetadata, getTagLanding, hasIndexableLandingImages } from '../../_lib/seoLanding';

type Props = { params: { tag: string } };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = getTagLanding(params.tag);
  return buildLandingMetadata(config, await hasIndexableLandingImages(config));
}

export default function ImageTagLandingPage({ params }: Props) {
  return <ImageSeoLandingPage config={getTagLanding(params.tag)} />;
}
