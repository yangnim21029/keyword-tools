/**
 * 地區映射常量
 * 使用索引簽名來允許字符串索引
 */
export const REGIONS: { [key: string]: string } = {
  "香港": "HK", 
  "台灣": "TW",
  "馬來西亞": "MY",
  "新加坡": "SG",
  "美國": "US",
  "韓國": "KR",
};

/**
 * 語言映射常量
 */
export const LANGUAGES = {
  'zh-TW': '繁體中文',
  'zh-CN': '簡體中文',
  'en': '英文',
  'ms': '馬來文',
  'ko': '韓文'
};

/**
 * Google Ads API 版本
 */
export const API_VERSION = 'v19';

/**
 * 地區代碼映射
 */
export const LOCATION_CODES: Record<string, number> = {
  "TW": 2158,   // 台灣
  "HK": 2344,   // 香港
  "US": 2840,   // 美國
  "JP": 2392,   // 日本
  "UK": 2826,   // 英國
  "CN": 2156,   // 中國
  "AU": 2036,   // 澳洲
  "CA": 2124,   // 加拿大
  "SG": 2702,   // 新加坡
  "MY": 2458,   // 馬來西亞
  "DE": 2276,   // 德國
  "FR": 2250,   // 法國
  "KR": 2410,   // 韓國
  "IN": 2356    // 印度
};

/**
 * 語言代碼映射
 */
export const LANGUAGE_CODES: Record<string, number> = {
  "zh_TW": 1018,  // 繁體中文
  "zh_CN": 1000,  // 簡體中文
  "en": 1000,     // 英文
  "ja": 1005,     // 日文
  "ko": 1012,     // 韓文
  "ms": 1102,     // 馬來文
  "fr": 1002,     // 法文
  "de": 1001,     // 德文
  "es": 1003,     // 西班牙文
};

/**
 * 常用符號數組
 */
export const SYMBOLS = ['?', '!', '@', '#', '$', '%', '&', '*', '(', ')', '-', '+', '=', '[', ']', '{', '}', '|', '\\', '/', '<', '>', ',', '.', ':', ';', '"', "'"];

/**
 * 英文字母數組
 */
export const ALPHABET = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

/**
 * 開發模式標誌
 * 設置為 true 啟用開發模式特性
 */
export const IS_DEVELOPMENT_MODE = process.env.NODE_ENV === 'development'; 