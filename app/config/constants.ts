/**
 * 地區映射常量
 * 使用索引簽名來允許字符串索引
 */
export const REGIONS: { [key: string]: string } = {
  香港: 'HK',
  台灣: 'TW',
  馬來西亞: 'MY',
  新加坡: 'SG',
  美國: 'US',
  韓國: 'KR'
};

/**
 * 語言映射常量
 */
export const LANGUAGES = {
  'zh-TW': '繁體中文',
  'zh-CN': '簡體中文',
  en: '英文',
  ms: '馬來文',
  ko: '韓文'
};

/**
 * 常用符號數組
 */
export const SYMBOLS = [
  '?',
  '!',
  '@',
  '#',
  '$',
  '%',
  '&',
  '*',
  '(',
  ')',
  '-',
  '+',
  '=',
  '[',
  ']',
  '{',
  '}',
  '|',
  '\\',
  '/',
  '<',
  '>',
  ',',
  '.',
  ':',
  ';',
  '"',
  "'"
];

/**
 * 英文字母數組
 */
export const ALPHABET = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z'
];

/**
 * 開發模式標誌
 * 設置為 true 啟用開發模式特性
 */
export const IS_DEVELOPMENT_MODE = process.env.NODE_ENV === 'development';
