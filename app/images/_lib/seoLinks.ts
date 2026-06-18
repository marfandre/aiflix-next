function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function cleanLandingValue(value: string): string {
  return cleanText(safeDecode(value).replace(/:(en|ru)$/i, ''));
}

export function humanizeLandingValue(value: string): string {
  return cleanLandingValue(value).replace(/[_-]+/g, ' ');
}

export function normalizeLandingParam(value: string): string {
  return cleanText(safeDecode(value)).toLowerCase();
}

export function slugify(value: string): string {
  return encodeURIComponent(
    cleanLandingValue(value)
      .toLowerCase()
      .replace(/['".,]/g, '')
      .replace(/[\s_]+/g, '-')
  );
}

export function aspectToPathSegment(value: string): string {
  return encodeURIComponent(value.replace(':', '-').replace('/', '-'));
}

export function pathSegmentToAspect(value: string): string {
  const decoded = safeDecode(value);
  return decoded.replace(/^(\d+)-(\d+)$/, '$1:$2').replace(/^(\d+)\/(\d+)$/, '$1:$2');
}

export function imageTagLandingHref(tag: string): string {
  return `/images/tags/${slugify(tag)}`;
}

export function imageModelLandingHref(model: string): string {
  return `/images/models/${slugify(model)}`;
}

export function imageColorLandingHref(colorFamily: string): string {
  return `/images/colors/${slugify(colorFamily)}`;
}

export function imageAspectLandingHref(aspectRatio: string): string {
  return `/images/aspect/${aspectToPathSegment(aspectRatio)}`;
}
