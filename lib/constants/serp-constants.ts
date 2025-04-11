// lib/constants/serpConstants.ts

// 定義不同語言的 SERP 標題和描述標準
export const languageStandards = {
  // 英文標準
  en: {
    title: {
      ideal: 60, // 理想的英文標題長度
      max: 70,   // 最大建議標題長度
    },
    description: {
      ideal: 160, // 理想的英文描述長度
      max: 175,   // 最大建議描述長度
    }
  },
  // 中文標準 (繁體)
  'zh-TW': {
    title: {
      ideal: 30, // 理想的中文標題字數
      max: 40,   // 最大建議標題字數
    },
    description: {
      ideal: 80,  // 理想的中文描述字數
      max: 100,   // 最大建議描述字數
    }
  },
  // 中文標準 (簡體)
  'zh-CN': {
    title: {
      ideal: 30, // 理想的中文標題字數
      max: 40,   // 最大建議標題字數
    },
    description: {
      ideal: 80,  // 理想的中文描述字數
      max: 100,   // 最大建議描述字數
    }
  },
  // 日文標準 (示例)
  ja: {
    title: {
      ideal: 32,
      max: 40,
    },
    description: {
      ideal: 120,
      max: 160,
    }
  },
  // 默認標準 (如果沒有特定語言設置，通常基於英文)
  default: {
    title: {
      ideal: 60,
      max: 70,
    },
    description: {
      ideal: 160,
      max: 175,
    }
  }
};

// 可以添加其他與 SERP 相關的常量
// export const DEFAULT_SERP_LANGUAGE = 'en'; 