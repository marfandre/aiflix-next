import type { Metadata } from 'next';
import ImageSeoLandingPage from '../../_components/ImageSeoLandingPage';
import { buildLandingMetadata, getColorLanding, hasIndexableLandingImages } from '../../_lib/seoLanding';

type Props = { params: { color: string } };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = getColorLanding(params.color);
  return buildLandingMetadata(config, await hasIndexableLandingImages(config));
}

export default function ImageColorLandingPage({ params }: Props) {
  return <ImageSeoLandingPage config={getColorLanding(params.color)} />;
}
