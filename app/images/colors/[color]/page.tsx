import type { Metadata } from 'next';
import ImageSeoLandingPage from '../../_components/ImageSeoLandingPage';
import { buildLandingMetadata, getColorLanding } from '../../_lib/seoLanding';

type Props = { params: { color: string } };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return buildLandingMetadata(getColorLanding(params.color));
}

export default function ImageColorLandingPage({ params }: Props) {
  return <ImageSeoLandingPage config={getColorLanding(params.color)} />;
}
