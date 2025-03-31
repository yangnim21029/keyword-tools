/**
 * 簡體/繁體中文檢測工具
 * 用於檢測文字是否包含簡體中文
 * 注意：實際實現已移至 app/services/keyword-data.service.ts
 * 此文件僅用於保持向後兼容性
 */

import {
    detectChineseType as detectType,
    filterSimplifiedChinese as filterSimplified
} from '@/app/services/keyword-data.service';

// 重新導出函數保持 API 相容性
export const detectChineseType = detectType;
export const filterSimplifiedChinese = filterSimplified; 