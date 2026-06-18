import type { Metadata } from 'next';
import ImageSeoLandingPage from '../../_components/ImageSeoLandingPage';
import { buildLandingMetadata, getModelLanding, hasIndexableLandingImages } from '../../_lib/seoLanding';

type Props = { params: { model: string } };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = getModelLanding(params.model);
  return buildLandingMetadata(config, await hasIndexableLandingImages(config));
}

export default function ImageModelLandingPage({ params }: Props) {
  return <ImageSeoLandingPage config={getModelLanding(params.model)} />;
}
