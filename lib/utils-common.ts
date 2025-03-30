/**
 * 計算預估處理時間（秒）
 * @param keywords 關鍵詞數組
 * @param withVolume 是否需要獲取搜索量
 * @returns 預估處理時間（秒）
 */
export function estimateProcessingTime(keywords: string[], withVolume: boolean = false): number {
  // 基本處理時間
  let baseTime = 1.0;
  
  // 關鍵詞數量因素
  const keywordFactor = keywords.length * 0.1;
  
  // 如果需要獲取搜索量，處理時間會更長
  const volumeFactor = withVolume ? keywords.length * 0.5 : 0;
  
  // API 請求批次因素 (每 20 個關鍵詞一批，每批至少 2 秒)
  const batchFactor = withVolume ? Math.ceil(keywords.length / 20) * 2 : 0;
  
  // 總預估時間（秒）
  return Math.ceil(baseTime + keywordFactor + volumeFactor + batchFactor);
}

/**
 * 檢查字符串是否為簡體中文
 * @param text 要檢查的文字
 * @returns 是否為簡體中文
 */
export function isSimplifiedChinese(text: string): boolean {
  const { detectChineseType } = require('@/utils/chineseDetector');
  const type = detectChineseType(text);
  return type === 'simplified';
}