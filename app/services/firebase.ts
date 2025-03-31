// Firebase 配置和初始化
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore, Timestamp } from 'firebase-admin/firestore';

// 初始化 Firebase Admin
let app: App | undefined;
export let db: Firestore | undefined;

// 确保 Firebase Admin 只初始化一次
if (!getApps().length) {
  try {
    // 检查必要的环境变量是否存在
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      console.error("Firebase 環境變量未設置，請在 .env.local 中配置 FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY 和 FIREBASE_CLIENT_EMAIL");
    }
    
    // 从环境变量获取 Firebase 凭证
    const serviceAccount = {
      "type": "service_account",
      "project_id": process.env.FIREBASE_PROJECT_ID || "",
      "private_key": process.env.FIREBASE_PRIVATE_KEY ? 
                    process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : "",
      "client_email": process.env.FIREBASE_CLIENT_EMAIL || "",
      "client_id": process.env.FIREBASE_CLIENT_ID || "",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL || "",
      "universe_domain": "googleapis.com"
    };

    app = initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });
    
    db = getFirestore(app);
    console.log("Firebase Admin SDK 初始化成功");
  } catch (error) {
    console.error("Firebase Admin SDK 初始化錯誤", error);
  }
} else {
  app = getApps()[0];
  db = getFirestore(app);
}

// 缓存相关常量
export const CACHE_EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000; // 7天的毫秒数
export const COLLECTIONS = {
  KEYWORD_SUGGESTIONS: 'keywordSuggestions',
  SEARCH_VOLUMES: 'searchVolumes',
  URL_SUGGESTIONS: 'urlSuggestions',
  KEYWORD_METADATA: 'keywordMetadata',
  SEARCH_HISTORY: 'searchHistory',
  SERP_RESULTS: 'serpResults',
  HTML_CONTENTS: 'htmlContents',  // 新增：HTML 內容集合
};

/**
 * Firebase 文档结构说明:
 * 
 * 1. keywordSuggestions 集合:
 *    - 文档ID: `${query}_${region}_${language}`
 *    - 字段:
 *      - query: 查询关键词
 *      - region: 地区代码
 *      - language: 语言代码
 *      - suggestions: 关键词建议数组
 *      - timestamp: 缓存时间戳
 * 
 * 2. searchVolumes 集合:
 *    - 文档ID: `${keywordsStr}_${region}`
 *    - 字段:
 *      - keywords: 关键词数组
 *      - region: 地区代码
 *      - results: 搜索量结果数组
 *      - timestamp: 缓存时间戳
 * 
 * 3. urlSuggestions 集合:
 *    - 文档ID: `${url}_${region}_${language}`
 *    - 字段:
 *      - url: 查询URL
 *      - region: 地区代码
 *      - language: 语言代码
 *      - suggestions: 关键词建议数组
 *      - timestamp: 缓存时间戳
 * 
 * 4. keywordMetadata 集合:
 *    - 文档ID: `${keyword}_${region}`
 *    - 字段:
 *      - keyword: 关键词文本
 *      - region: 地区代码
 *      - searchVolume: 月搜索量
 *      - competition: 竞争程度
 *      - competitionIndex: 竞争指数
 *      - cpc: 点击价格
 *      - timestamp: 缓存时间戳
 * 
 * 5. searchHistory 集合:
 *    - 文档ID: 自动生成
 *    - 字段:
 *      - mainKeyword: 主关键词
 *      - region: 地区代码
 *      - language: 语言代码
 *      - suggestions: 关键词建议数组
 *      - searchResults: 搜索量结果数组
 *      - timestamp: 搜索时间戳
 */

// 缓存单个关键词的元数据
export async function cacheKeywordMetadata(
  keyword: string, 
  region: string, 
  data: { 
    searchVolume: number, 
    competition: string, 
    competitionIndex: number, 
    cpc: number | null 
  }
) {
  if (!db) return;
  
  try {
    const cacheId = `${keyword}_${region}`;
    await db.collection(COLLECTIONS.KEYWORD_METADATA).doc(cacheId).set({
      keyword,
      region,
      ...data,
      timestamp: Timestamp.now(),
    });
    console.log(`已緩存關鍵詞元數據: ${keyword} (區域: ${region})`);
  } catch (error) {
    console.error("緩存關鍵詞元數據時出錯:", error);
  }
}

// 获取单个关键词的元数据
export async function getKeywordMetadata(keyword: string, region: string) {
  if (!db) return null;
  
  try {
    const cacheId = `${keyword}_${region}`;
    const docSnap = await db.collection(COLLECTIONS.KEYWORD_METADATA).doc(cacheId).get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      if (!data) return null;
      
      const timestamp = data.timestamp.toDate();
      const now = new Date();
      
      if (now.getTime() - timestamp.getTime() < CACHE_EXPIRY_TIME) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error("獲取關鍵詞元數據時出錯:", error);
    return null;
  }
}

// 缓存搜索量数据 - 不再缓存单个关键词元数据，只缓存批量数据
export async function cacheSearchVolumes(keywords: string[], region: string, results: any[]) {
  if (!db) return;
  
  try {
    // 使用keywords和region的组合作为缓存ID
    const keywordsStr = keywords.sort().join(',');
    const cacheId = `${keywordsStr}_${region}`;
    
    // 缓存整批搜索量数据
    await db.collection(COLLECTIONS.SEARCH_VOLUMES).doc(cacheId).set({
      keywords,
      region,
      results,
      timestamp: Timestamp.now(),
    });
    
    // 不再一条条地缓存每个关键词的元数据
    // 这部分将在未来实现
    
    console.log(`已批量緩存 ${keywords.length} 個關鍵詞的搜索量數據 (區域: ${region})`);
  } catch (error) {
    console.error("緩存搜索量數據時出錯:", error);
  }
}

// 获取缓存的搜索量数据 - 只查找批量缓存的数据
export async function getCachedSearchVolumes(keywords: string[], region: string): Promise<any[] | null> {
  if (!db) return null;
  
  try {
    // 尝试获取批量缓存的数据
    const keywordsStr = keywords.sort().join(',');
    const cacheId = `${keywordsStr}_${region}`;
    
    const docSnap = await db.collection(COLLECTIONS.SEARCH_VOLUMES).doc(cacheId).get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      if (!data) return null;
      
      const timestamp = data.timestamp.toDate();
      const now = new Date();
      
      if (now.getTime() - timestamp.getTime() < CACHE_EXPIRY_TIME) {
        console.log(`使用批量緩存的搜索量數據 (${keywords.length} 個關鍵詞)`);
        return data.results;
      } else {
        console.log(`批量緩存已過期`);
      }
    }
    
    // 不再尝试逐个获取关键词元数据
    console.log(`未找到批量緩存數據，需要從 API 獲取`);
    return null;
  } catch (error) {
    console.error("獲取緩存搜索量數據時出錯:", error);
    return null;
  }
}

// 确认数据库中已有多少记录
export async function getDatabaseStats() {
  if (!db) return null;
  
  try {
    const stats: Record<string, number> = {};
    
    for (const collName of Object.values(COLLECTIONS)) {
      const snapshot = await db.collection(collName).get();
      stats[collName] = snapshot.size;
    }
    
    return stats;
  } catch (error) {
    console.error("獲取數據庫統計資訊時出錯:", error);
    return null;
  }
}

// 获取搜索历史列表（按时间倒序，最新的在前）
export async function getSearchHistoryList(limit: number = 50) {
  if (!db) return [];
  
  try {
    const snapshot = await db.collection(COLLECTIONS.SEARCH_HISTORY)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    const historyList = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        mainKeyword: data.mainKeyword,
        region: data.region,
        language: data.language,
        timestamp: data.timestamp.toDate(),
        suggestionCount: data.suggestions?.length || 0,
        resultsCount: data.searchResults?.length || 0,
      };
    });
    
    return historyList;
  } catch (error) {
    // 檢查是否為配額錯誤
    if (error instanceof Error && 
        (error.message.includes('RESOURCE_EXHAUSTED') || 
         error.message.includes('Quota exceeded'))) {
      console.warn("Firebase 配額已用盡，無法獲取搜索歷史。請考慮升級計劃或等待配額重置。");
    } else {
      console.error("搜索歷史數據獲取失敗:", error);
    }
    return [];
  }
}

// 获取特定搜索历史的详细数据
export async function getSearchHistoryDetail(historyId: string) {
  if (!db) return null;
  
  try {
    const docRef = await db.collection(COLLECTIONS.SEARCH_HISTORY).doc(historyId).get();
    
    if (!docRef.exists) {
      return null;
    }
    
    const data = docRef.data();
    if (!data) return null;
    
    return {
      id: docRef.id,
      mainKeyword: data.mainKeyword,
      region: data.region,
      language: data.language,
      suggestions: data.suggestions || [],
      searchResults: data.searchResults || [],
      timestamp: data.timestamp.toDate(),
    };
  } catch (error) {
    // 檢查是否為配額錯誤
    if (error instanceof Error && 
        (error.message.includes('RESOURCE_EXHAUSTED') || 
         error.message.includes('Quota exceeded'))) {
      console.warn("Firebase 配額已用盡，無法獲取搜索歷史詳情。請考慮升級計劃或等待配額重置。");
    } else {
      console.error("搜索歷史詳情獲取失敗:", error);
    }
    return null;
  }
}

// 生成 URL 的哈希值作為文檔 ID
function generateUrlHash(url: string): string {
  // 使用簡單的哈希函數
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36); // Convert to base36 string
}

// 保存 HTML 內容到 Firebase
export async function saveHtmlContent(url: string, content: any) {
  if (!db) return;
  
  try {
    // 使用 URL 的哈希值作為文檔 ID
    const docId = generateUrlHash(url);
    const docRef = db.collection(COLLECTIONS.HTML_CONTENTS).doc(docId);
    
    await docRef.set({
      ...content,
      timestamp: Timestamp.now(),
      url: url, // 保存原始 URL
      docId: docId // 保存文檔 ID 以便查詢
    });
    
    console.log(`已保存 HTML 內容: ${url}`);
  } catch (error) {
    console.error('保存 HTML 內容時出錯:', error);
    throw error;
  }
}

// 獲取 HTML 內容
export async function getHtmlContent(url: string) {
  if (!db) return null;
  
  try {
    // 使用 URL 的哈希值作為文檔 ID
    const docId = generateUrlHash(url);
    
    // 首先嘗試通過 docId 查詢
    const docRef = await db.collection(COLLECTIONS.HTML_CONTENTS).doc(docId).get();
    
    if (docRef.exists) {
      const data = docRef.data();
      if (!data) return null;
      
      // 驗證 URL 是否匹配
      if (data.url !== url) {
        console.warn(`URL 不匹配: 期望 ${url}, 實際 ${data.url}`);
        return null;
      }
      
      const timestamp = data.timestamp.toDate();
      const now = new Date();
      
      // 檢查緩存是否過期 (7天)
      if (now.getTime() - timestamp.getTime() < CACHE_EXPIRY_TIME) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error("獲取 HTML 內容時出錯:", error);
    return null;
  }
}

// 更新 SERP 結果，添加 HTML 分析
export async function updateSerpResultWithHtmlAnalysis(
  cacheId: string,
  keyword: string,
  url: string,
  htmlAnalysis: {
    h1: string[];
    h2: string[];
    h3: string[];
    h1Consistency: boolean;
    html: string;
  }
) {
  if (!db) return;
  
  try {
    const serpRef = db.collection(COLLECTIONS.SERP_RESULTS).doc(cacheId);
    const serpDoc = await serpRef.get();
    
    if (!serpDoc.exists) {
      console.error('找不到 SERP 結果文檔:', cacheId);
      return;
    }
    
    const serpData = serpDoc.data();
    if (!serpData || !serpData.results || !serpData.results[keyword]) {
      console.error('找不到關鍵詞的 SERP 結果:', keyword);
      return;
    }
    
    // 找到對應的搜索結果
    const results = serpData.results[keyword].results;
    const resultIndex = results.findIndex((r: any) => r.url === url);
    
    if (resultIndex === -1) {
      console.error('找不到對應的搜索結果:', url);
      return;
    }
    
    // 只保存分析結果，不保存完整 HTML
    const analysisToSave = {
      h1: htmlAnalysis.h1,
      h2: htmlAnalysis.h2,
      h3: htmlAnalysis.h3,
      h1Consistency: htmlAnalysis.h1Consistency,
      // 移除 html 字段以減少文檔大小
    };
    
    // 更新搜索結果中的 htmlAnalysis
    results[resultIndex].htmlAnalysis = analysisToSave;
    
    // 更新 Firebase 文檔
    await serpRef.update({
      [`results.${keyword}.results`]: results,
      lastUpdated: Timestamp.now()
    });
    
    console.log(`已更新搜索結果的 HTML 分析: ${url}`);
  } catch (error) {
    console.error('更新 SERP 結果時出錯:', error);
    throw error;
  }
}
