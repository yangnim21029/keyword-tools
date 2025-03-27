// Firebase 配置和初始化
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Timestamp, Firestore } from 'firebase-admin/firestore';

// Firebase Admin 凭证（应该从环境变量加载，这里为了简化直接使用）
const serviceAccount = {
  "type": "service_account",
  "project_id": "seo-preogic",
  "private_key_id": "f43e8d9f3ee2b0e80645285b296db2c68f56dc46",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCnbNQnlYL53iRa\n4fSy89KRHeSrEIldtpmm7/PEQ8HIxJRmssyMemdcckPuyfZq6UPDs95DReWx97N/\nk10EisTKgc/TkXTI/YE38M+xI2SaPBvoYA1O6c0cVI21bJDjj2MkrPjuf3nkMRzC\nCLeIefBS0kkv0Q2n2aJaB0zBZ9oQXv2HgwM8wwYOMXEE/DHIaYJJdAGd8ExRpd4N\nfCZngWj6CNDPiTRozAnHWlNwRzT0MktGiXwQ0tL2/7PPTOjdmYJeZPCZk5/6e+W/\nJy1d0hR+YrVxWGDCV9EOr1T4YxDSrcUOABa93wxVluTQ/3FQ3HSzE6+koqfqO9LN\nzohx++nvAgMBAAECggEALgdX7kgG+a3uXcQIM5if18CZqMQDl+2HIaOPZ3JfWNRe\nnjtiy+4s83gAoCoLIopd1HRjUyhoxTw9r4GyjXifMLNukRJIwqcbOudsGh2KX3LO\nE10w23SgrLy8NtgRn1ZA4gjh6SPHvYoZB2lBF/a6MPLaJxi4weAt58Vg/z0PcPdS\nqeFKYSGPJmmKnDnDiMiVfzppo5wyR7Ss2aR6piYYe0YK445qxQv7jgSLOSmEiMxu\nfAMsAL+1mv4ZfUAhbRcMXackKHEFAEsJ3ubK7w5/y1NVlnP1PAlIwcuHumXz97SJ\nuX66Hke+6sL59xZO1agNhpRlaftx0/n9t01y3f0QBQKBgQDUcXLJvKR3/rylA2Br\nH/4KaF2RMaASgVTtaqHaq1MSLwGWTejt5u1tJgJInqvTri1ZGYLcuZtYxJTLiKCL\n3MCvX3n+sV0GXtJYSxl42tL27qvjR8hgqIJSsoPcQ1FbhFnqRFDO/s4kebeXzdoZ\nRqoAmHSzhdWXYrSkOBaLkXZHewKBgQDJwIISqbN9lgy9xdQSuNCK/DEEkuffrU6q\ndNATaxGfOrowMIxtwi/9Mpv58YBcIfdJppc+FAIHAapnq7jHaC2QU7pG2AGNwsqt\nWE8uCACd2DB9IMfzUDzZNu6+lAK/qWHO7GANdMz1UjynaZIGbzEqQtFW677AlkAj\nHyA5snAjHQKBgQCsqMeyTi8dl1uagXQLnKTLsKbbKon+gD6V9uQ05KlPTgTsM8Xs\nFJNC8nFItCzSje0tTR6eZftr2dlU0mYpRfEUl3R/G4ePdeFfASpinvZ22uO4hM7G\nQC4rKAsjKVMmHhs12vASS+UeoA4mwpdPk673bPDsNwmxT/egwDUSmdaXoQKBgHqL\n9HZhniUqf5LGF4tHt2S0yxF8KlwzaRUg30LsRkfx5CZhVutUiNHDa/rmNpHAD/Us\nu7F5dcHLwTY3mIWHQiXotb1Sd58kMvgYLABJ3BYEu29F+i5RDqTiOSKJxSGmQULv\nUWjbCaP5z93gwlImODbzXzTs/XD90veCcJCbUoIBAoGBAJccyS3Pw6AF9NOEIeth\nbFr1EWGwbyyHkS5Cqwrmc7viYCSoMAhOm3/xEHqw13kgUob1LKl5iiTk1aUtaBWu\n5qxRSKXVf7A6bCv0jdT30X9hSBDgqN7Q4snan0v+qgeqNDtvOxCIUhkrZk3CJ5CX\nLODBBlAR8Xq4jXApGFPrSNR8\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@seo-preogic.iam.gserviceaccount.com",
  "client_id": "106865783745185249700",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40seo-preogic.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// 初始化 Firebase Admin
let app: App | undefined;
let db: Firestore | undefined;

// 确保 Firebase Admin 只初始化一次
if (!getApps().length) {
  try {
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
const CACHE_EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000; // 7天的毫秒数
const COLLECTIONS = {
  KEYWORD_SUGGESTIONS: 'keywordSuggestions',
  SEARCH_VOLUMES: 'searchVolumes',
  URL_SUGGESTIONS: 'urlSuggestions',
  KEYWORD_METADATA: 'keywordMetadata',  // 新增：单个关键词元数据集合
  SEARCH_HISTORY: 'searchHistory',      // 新增：搜索历史记录集合
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

// 缓存关键词建议
export async function cacheKeywordSuggestions(query: string, region: string, language: string, suggestions: string[]) {
  if (!db) return;
  
  try {
    const cacheId = `${query}_${region}_${language}`;
    await db.collection(COLLECTIONS.KEYWORD_SUGGESTIONS).doc(cacheId).set({
      query,
      region,
      language,
      suggestions,
      timestamp: Timestamp.now(),
    });
    console.log(`已緩存關鍵詞建議: ${cacheId}`);
  } catch (error) {
    console.error("緩存關鍵詞建議時出錯:", error);
  }
}

// 获取缓存的关键词建议
export async function getCachedKeywordSuggestions(query: string, region: string, language: string): Promise<string[] | null> {
  if (!db) return null;
  
  try {
    const cacheId = `${query}_${region}_${language}`;
    const docSnap = await db.collection(COLLECTIONS.KEYWORD_SUGGESTIONS).doc(cacheId).get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      if (!data) return null;
      
      const timestamp = data.timestamp.toDate();
      const now = new Date();
      
      // 检查缓存是否过期
      if (now.getTime() - timestamp.getTime() < CACHE_EXPIRY_TIME) {
        console.log(`使用緩存關鍵詞建議: ${cacheId}`);
        return data.suggestions;
      } else {
        console.log(`緩存已過期: ${cacheId}`);
      }
    }
    return null;
  } catch (error) {
    console.error("獲取緩存關鍵詞建議時出錯:", error);
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

// 缓存URL建议
export async function cacheUrlSuggestions(url: string, region: string, language: string, suggestions: string[]) {
  if (!db) return;
  
  try {
    const cacheId = `${url}_${region}_${language}`;
    await db.collection(COLLECTIONS.URL_SUGGESTIONS).doc(cacheId).set({
      url,
      region,
      language,
      suggestions,
      timestamp: Timestamp.now(),
    });
    console.log(`已緩存URL建議: ${url}`);
  } catch (error) {
    console.error("緩存URL建議時出錯:", error);
  }
}

// 获取缓存的URL建议
export async function getCachedUrlSuggestions(url: string, region: string, language: string): Promise<string[] | null> {
  if (!db) return null;
  
  try {
    const cacheId = `${url}_${region}_${language}`;
    const docSnap = await db.collection(COLLECTIONS.URL_SUGGESTIONS).doc(cacheId).get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      if (!data) return null;
      
      const timestamp = data.timestamp.toDate();
      const now = new Date();
      
      if (now.getTime() - timestamp.getTime() < CACHE_EXPIRY_TIME) {
        console.log(`使用緩存URL建議: ${url}`);
        return data.suggestions;
      } else {
        console.log(`緩存已過期: ${url}`);
      }
    }
    return null;
  } catch (error) {
    console.error("獲取緩存URL建議時出錯:", error);
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

// 保存搜索历史
export async function saveSearchHistory(
  mainKeyword: string, 
  region: string, 
  language: string, 
  suggestions: string[], 
  searchResults: any[]
): Promise<string | null> {
  if (!db) return null;
  
  try {
    const historyData = {
      mainKeyword,
      region,
      language,
      suggestions: suggestions.slice(0, 100), // 限制存储数量
      searchResults: searchResults.slice(0, 100), // 限制存储数量
      timestamp: Timestamp.now(),
    };
    
    // 使用自动ID来避免覆盖
    const docRef = await db.collection(COLLECTIONS.SEARCH_HISTORY).add(historyData);
    
    console.log(`已保存搜索歷史: "${mainKeyword}" (${region})`);
    return docRef.id;
  } catch (error) {
    console.error("保存搜索歷史時出錯:", error);
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
    console.error("獲取搜索歷史列表時出錯:", error);
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
    console.error("獲取搜索歷史詳細數據時出錯:", error);
    return null;
  }
}

export { db }; 