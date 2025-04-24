'use client'; // Keep this simple, client-side for now

import Image from 'next/image';

interface SiteFaviconProps {
  siteUrl: string;
  siteName: string;
  size?: number;
}

/**
 * Renders a site favicon using Google's favicon service and next/image.
 * NOTE: Requires adding 'www.google.com' to domains in next.config.js images config.
 */
export function SiteFavicon({ siteUrl, siteName, size = 16 }: SiteFaviconProps) {
  if (!siteUrl) return null; // Don't render if no URL

  const faviconUrl = `https://www.google.com/s2/favicons?sz=${size}&domain_url=${siteUrl}`;

  return (
    <Image
      src={faviconUrl}
      alt={`${siteName} icon`}
      title={siteName} // Show site name on hover
      width={size}
      height={size}
      className="rounded-sm flex-shrink-0" // Added flex-shrink-0
      unoptimized={true} // Set true to avoid domain config issues for simplicity, can be removed if configured
    />
  );
} 