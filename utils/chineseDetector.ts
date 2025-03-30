/**
 * 簡體/繁體中文檢測工具
 * 用於檢測文字是否包含簡體中文
 */

// 簡體中文和繁體中文對照表 (常用字)
const simplifiedToTraditional: Record<string, string> = {
  '个': '個', '东': '東', '丝': '絲', '丢': '丟', '两': '兩', '严': '嚴', '丧': '喪',
  '丰': '豐', '临': '臨', '为': '為', '丽': '麗', '举': '舉', '么': '麼',
  '义': '義', '乌': '烏', '乐': '樂', '乔': '喬', '习': '習', '乡': '鄉', '书': '書',
  '买': '買', '乱': '亂', '争': '爭', '于': '於', '亏': '虧', '云': '雲', '亚': '亞',
  '产': '產', '亩': '畝', '亲': '親', '亵': '褻', '亿': '億', '仅': '僅', '从': '從',
  '仑': '侖', '仓': '倉', '仪': '儀', '们': '們', '价': '價', '众': '眾', '优': '優',
  '伙': '夥', '会': '會', '伟': '偉', '传': '傳', '伤': '傷', '伦': '倫', '伪': '偽',
  '体': '體', '佣': '傭', '佬': '佬', '侠': '俠', '侧': '側', '侨': '僑', '侬': '儂',
  '俣': '俁', '俦': '儔', '俨': '儼', '俩': '倆', '俭': '儉', '债': '債', '倾': '傾',
  '偬': '傯', '偻': '僂', '伥': '倀', '偾': '僨', '偿': '償', '杂': '雜', '鸡': '雞',
  '阳': '陽', '阴': '陰', '阵': '陣', '阶': '階','尔': '爾', '邬': '鄔', '邙': '鄣','图': '圖','卢': '盧', '贝': '貝','达': '達', '逻': '邏', '辑': '輯'
};

// 檢測文字是否包含簡體中文
export function detectChineseType(text: string): 'simplified' | 'traditional' | 'mixed' | 'none' {
  let hasSimplified = false;
  let hasTraditional = false;
  let hasChineseChars = false;

  // 檢查每個字符
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // 判斷是否為中文字符
    if (/[\u4e00-\u9fa5]/.test(char)) {
      hasChineseChars = true;
      
      // 檢查是否為簡體字
      if (char in simplifiedToTraditional) {
        hasSimplified = true;
      } else {
        // 檢查字符是否為繁體字
        for (const [simplified, traditional] of Object.entries(simplifiedToTraditional)) {
          if (char === traditional) {
            hasTraditional = true;
            break;
          }
        }
      }
    }
  }

  // 根據檢測結果返回類型
  if (!hasChineseChars) {
    return 'none';
  } else if (hasSimplified && hasTraditional) {
    return 'mixed';
  } else if (hasSimplified) {
    return 'simplified';
  } else {
    return 'traditional';
  }
}

// 過濾掉簡體中文關鍵詞
export function filterSimplifiedChinese(keywords: string[]): string[] {
  return keywords.filter(keyword => {
    const type = detectChineseType(keyword);
    return type !== 'simplified';
  });
} 