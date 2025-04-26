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

// Simplified to Traditional Chinese character map (common characters)
// Export the map so it can be used by detectChineseType if needed elsewhere
export const simplifiedToTraditional: Record<string, string> = {
  樱: '櫻',
  晒: '曬',
  个: '個',
  东: '東',
  丝: '絲',
  丢: '丟',
  两: '兩',
  严: '嚴',
  丧: '喪',
  丰: '豐',
  临: '臨',
  为: '為',
  丽: '麗',
  举: '舉',
  么: '麼',
  义: '義',
  乌: '烏',
  乐: '樂',
  乔: '喬',
  习: '習',
  乡: '鄉',
  书: '書',
  买: '買',
  乱: '亂',
  争: '爭',
  于: '於',
  亏: '虧',
  云: '雲',
  亚: '亞',
  产: '產',
  亩: '畝',
  亲: '親',
  亿: '億',
  仅: '僅',
  从: '從',
  仑: '侖',
  仓: '倉',
  仪: '儀',
  们: '們',
  价: '價',
  众: '眾',
  优: '優',
  伙: '夥',
  会: '會',
  伟: '偉',
  传: '傳',
  伤: '傷',
  伦: '倫',
  伪: '偽',
  体: '體',
  佣: '傭',
  佬: '佬',
  侠: '俠',
  侧: '側',
  侨: '僑',
  侬: '儂',
  俣: '俁',
  俦: '儔',
  俨: '儼',
  俩: '倆',
  俭: '儉',
  债: '債',
  倾: '傾',
  偬: '傯',
  偻: '僂',
  伥: '倀',
  偾: '僨',
  偿: '償',
  杂: '雜',
  鸡: '雞',
  阳: '陽',
  阴: '陰',
  阵: '陣',
  阶: '階',
  尔: '爾',
  邬: '鄔',
  邙: '鄣',
  图: '圖',
  卢: '盧',
  贝: '貝',
  达: '達',
  逻: '邏',
  辑: '輯'
  // Add more mappings as needed
};

/**
 * Checks if a string contains any simplified Chinese characters.
 * @param text The text to check.
 * @returns True if simplified Chinese characters are present, false otherwise.
 */
export function hasSimplifiedChinese(text: string): boolean {
  let hasSimplified = false;
  let hasTraditional = false;
  let hasChineseChars = false; // Track if any Chinese chars exist

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (/[一-龥]/.test(char)) {
      hasChineseChars = true;
      if (char in simplifiedToTraditional) {
        hasSimplified = true;
        // Optimization: If we find a simplified char, we know the result is true.
        return true;
      } else {
        // Check if it might be traditional (only relevant for 'mixed' detection if needed)
        for (const traditional of Object.values(simplifiedToTraditional)) {
          if (char === traditional) {
            hasTraditional = true;
            break;
          }
        }
      }
    }
    // Optimization: If text contains both simplified and traditional, it also contains simplified.
    if (hasSimplified && hasTraditional) {
      return true;
    }
  }

  return hasSimplified;
}
