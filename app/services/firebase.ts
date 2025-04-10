// Firebase 配置和初始化
// (Initialization moved to app/services/firebase/config.ts)

// Keep the Firestore structure comments if they are useful here

/**
 * Firebase 文档结构说明 (根據 README.md):
 * 
 * 1. keywordResearch 集合 (COLLECTIONS.KEYWORD_RESEARCH):
 *    - 文档ID: 自动生成
 *    - 字段:
 *      - id: string (文檔 ID)
 *      - query: string (主關鍵詞)
 *      - keywords?: Keyword[] (關鍵詞列表)
 *      - clusters?: Record<string, string[]> (語義分群)
 *      - personas?: Record<string, string> (用戶畫像)
 *      - location?: string (地區)
 *      - language?: string (語言)
 *      - createdAt: Timestamp
 *      - updatedAt: Timestamp
 *      - (其他字段如 userId, searchEngine, device, isFavorite, tags 等根據需要)
 * 
 * 2. serp 集合 (COLLECTIONS.SERP):
 *    - 文档ID: 自动生成或基於查詢?
 *    - 字段:
 *      - id: string (文檔 ID)
 *      - type: string (固定為 "serp")
 *      - query?: string (主查詢關鍵詞)
 *      - serpResults?: SerpResultItem[] (包含 title, metadescription, url, position, type, device)
 *      - domains: Record<string, number> (域名分布)
 *      - analysis?: { // 分析結果
 *          avgTitleLength?: number;
 *          avgDescriptionLength?: number;
 *          pageTypeDistribution?: Record<string, number>;
 *          htmlAnalysisSummary?: any; // HTML分析摘要
 *        }
 *      - createdAt: Timestamp
 *      - updatedAt: Timestamp
 *      - (其他元數據如 location, language, device 等根據需要)
 */

// No more functions - saveHtmlContent and getHtmlContent removed.
// HTML content saving/retrieval should be part of the SERP processing logic.
