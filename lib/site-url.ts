const LOCAL_DEV_URL = 'http://localhost:3000';

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return LOCAL_DEV_URL;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    return normalizeUrl(explicit);
  }

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProduction) {
    return normalizeUrl(vercelProduction);
  }

  const vercelPreview = process.env.VERCEL_URL;
  if (vercelPreview) {
    return normalizeUrl(vercelPreview);
  }

  return LOCAL_DEV_URL;
}

export function getBaseUrlObject(): URL {
  return new URL(getBaseUrl());
}
