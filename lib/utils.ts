import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Add the exported formatVolume function
export function formatVolume(volume: number | null | undefined): string {
  if (volume === null || volume === undefined) {
    return 'N/A';
  }
  if (volume >= 1000000) {
    return (volume / 1000000).toFixed(1) + 'M';
  }
  if (volume >= 1000) {
    return (volume / 1000).toFixed(1) + 'K';
  }
  return volume.toString();
}

/**
 * Safely converts various timestamp representations to a Date object.
 * Handles Firestore Timestamps ({ seconds, nanoseconds }), Date objects, and date strings.
 * Returns null if conversion fails or input is invalid.
 */
export function convertTimestampToDate(timestamp: any): Date | null {
  if (!timestamp) {
    return null;
  }

  // Handle Firestore Timestamp object (duck typing)
  if (
    typeof timestamp === 'object' &&
    timestamp !== null &&
    typeof timestamp.seconds === 'number' &&
    typeof timestamp.nanoseconds === 'number'
  ) {
    try {
      // Convert Firestore Timestamp to Date
      const date = new Date(
        timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000
      );
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (e) {
      console.error('Error converting Firestore-like timestamp:', e);
      return null; // Conversion failed
    }
  }

  // Handle existing Date object
  if (timestamp instanceof Date) {
    if (!isNaN(timestamp.getTime())) {
      return timestamp;
    }
    return null; // Invalid Date object
  }

  // Handle date string
  if (typeof timestamp === 'string') {
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (e) {
      console.error('Error converting timestamp string:', e);
      // Fall through to return null
    }
  }

  console.warn('Failed to convert timestamp to Date:', timestamp);
  return null; // Return null if input is not recognized or conversion fails
}

// Add other client-safe utility functions here if needed
