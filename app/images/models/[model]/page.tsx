import type { Metadata } from 'next';
import ImageSeoLandingPage from '../../_components/ImageSeoLandingPage';
import { buildLandingMetadata, getModelLanding } from '../../_lib/seoLanding';

type Props = { params: { model: string } };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return buildLandingMetadata(getModelLanding(params.model));
}

export default function ImageModelLandingPage({ params }: Props) {
  return <ImageSeoLandingPage config={getModelLanding(params.model)} />;
}
