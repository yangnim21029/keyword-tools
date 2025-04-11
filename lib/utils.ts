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
