/**
 * Resolve remind-asset URLs into blob URLs for display.
 */

const assetScheme = 'remind-asset:';

export async function resolveAssetUrls(
  html: string,
  resolver: (assetId: string) => Promise<Blob | null>
): Promise<string> {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const images = Array.from(doc.querySelectorAll('img'));

  for (const image of images) {
    const existingAsset = image.getAttribute('data-asset');
    const src = image.getAttribute('src') ?? '';
    const assetId = existingAsset || (src.startsWith(assetScheme) ? src.slice(assetScheme.length) : '');
    if (!assetId) {
      continue;
    }

    const blob = await resolver(assetId);
    if (!blob) {
      continue;
    }

    const blobUrl = URL.createObjectURL(blob);
    image.setAttribute('data-asset', assetId);
    image.setAttribute('src', blobUrl);
  }

  return doc.body.innerHTML;
}
