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

/**
 * Converts a keyword into a safe string suitable for Firestore document ID.
 * Replaces spaces and non-alphanumeric characters (excluding hyphens) with hyphens,
 * converts to lowercase, and limits length.
 * @param keyword The raw keyword string.
 * @returns A sanitized string suitable for use as a Firestore document ID.
 */
export function sanitizeKeywordForId(keyword: string): string {
  if (!keyword) return ''; // Handle empty input
  return keyword
    .toLowerCase() // Convert to lowercase
    .replace(/[^a-z0-9\-\s]/g, '') // Remove non-alphanumeric (allow space, hyphen)
    .trim() // Trim leading/trailing whitespace
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .slice(0, 150); // Limit length (adjust as needed, Firestore limit is 1500 bytes)
}

// Add other client-safe utility functions here if needed
