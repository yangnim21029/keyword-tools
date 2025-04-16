import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Add the exported formatVolume function
export const formatVolume = (volume: number): string => {
  if (typeof volume !== 'number' || isNaN(volume)) {
    return '0'; // Return '0' or perhaps '-' for invalid input
  }
  if (volume >= 10000) return `${(volume / 1000).toFixed(0)}k`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
  return volume.toLocaleString();
};

/* // No longer needed for generating Firestore IDs
export function sanitizeKeywordForId(keyword: string): string {
  if (!keyword || typeof keyword !== 'string') return ''; // Handle empty/invalid input

  const sanitized = keyword
    .trim() // Trim leading/trailing whitespace first
    .toLowerCase() // Convert to lowercase
    // Replace forward slashes (invalid in Firestore IDs) with underscores
    .replace(/\//g, '_')
    // Replace multiple consecutive whitespace characters with a single hyphen
    .replace(/\s+/g, '-')
    // Remove characters explicitly disallowed or problematic in IDs (if any beyond slash needed)
    // For now, we focus on slashes. We keep most unicode characters.
    // .replace(/[<>*?"|]/g, '') // Example: remove other potentially problematic chars
    .slice(0, 500); // Limit length (Firestore limit is 1500 bytes, 500 chars is safer)

  // Ensure the result is not empty or just '.' or '..'
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    console.warn(
      `Sanitization resulted in an invalid ID for keyword: "${keyword}". Returning empty string.`
    );
    // Consider alternative handling, like hashing the original keyword if empty
    return ''; // Return empty, let the calling function handle the error
  }

  return sanitized;
}
*/

// Add other client-safe utility functions here if needed
