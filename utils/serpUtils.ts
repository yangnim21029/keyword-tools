// utils/serpUtils.ts
import { languageStandards } from "@/lib/constants/serpConstants";
import { ApifyOrganicResult } from "@/lib/schemas"; // Import the correct type

// Define the structure for language standard (can be inferred or defined explicitly)
type LanguageStandard = typeof languageStandards.default;

/**
 * Evaluates title length against language standards and returns a CSS color class.
 * @param length - The length of the title.
 * @param standard - The language standard object.
 * @returns Tailwind CSS text color class (e.g., 'text-green-700').
 */
export const evaluateTitleLengthClass = (length: number, standard: LanguageStandard): string => {
  if (length <= standard.title.ideal) return 'text-green-700'; // Use theme colors
  if (length <= standard.title.max) return 'text-yellow-600'; // Use theme colors
  return 'text-red-600'; // Use theme colors
};

/**
 * Evaluates description length against language standards and returns a CSS color class.
 * @param length - The length of the description.
 * @param standard - The language standard object.
 * @returns Tailwind CSS text color class.
 */
export const evaluateDescriptionLengthClass = (length: number, standard: LanguageStandard): string => {
  if (length <= standard.description.ideal) return 'text-green-700';
  if (length <= standard.description.max) return 'text-yellow-600';
  return 'text-red-600';
};

/**
 * Calculates the percentage of SERP results meeting ideal title and description length standards.
 * @param results - An array of SERP items.
 * @param standard - The language standard object.
 * @returns An object with title and description compliance percentages.
 */
export const calculateLengthCompliance = (
  results: ApifyOrganicResult[] | undefined | null,
  standard: LanguageStandard
): { title: number; description: number } => {
  if (!results || results.length === 0) {
    return { title: 0, description: 0 };
  }

  const totalResults = results.length;
  const goodTitles = results.filter(r => r.title.length <= standard.title.ideal).length;
  const goodDescriptions = results.filter(r => r.description.length <= standard.description.ideal).length;

  return {
    title: Math.round((goodTitles / totalResults) * 100),
    description: Math.round((goodDescriptions / totalResults) * 100)
  };
}; 