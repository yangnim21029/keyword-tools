// Firebase 配置和初始化
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS } from './firebase/config';

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
    // Now uses imported COLLECTIONS and Timestamp
    const docRef = db.collection(COLLECTIONS.CONTENT_ANALYSIS).doc(docId); // Use CONTENT_ANALYSIS collection
    
    await docRef.set({
      ...content,
      timestamp: Timestamp.now(), // Use imported Timestamp
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
    
    // Now uses imported COLLECTIONS
    const docRef = await db.collection(COLLECTIONS.CONTENT_ANALYSIS).doc(docId).get(); // Use CONTENT_ANALYSIS collection
    
    if (docRef.exists) {
      const data = docRef.data();
      if (!data) return null;
      
      // 驗證 URL 是否匹配 (Optional check)
      if (data.url !== url) {
        console.warn(`URL mismatch: Expected ${url}, found ${data.url}`);
        // Decide if mismatch should return null or data
        // return null; 
      }
            
      // Removed cache expiry check
      return data; // Directly return data without checking expiry
      /*
      const timestamp = data.timestamp.toDate();
      const now = new Date();
      
      // 檢查緩存是否過期 (7天)
      // Removed: if (now.getTime() - timestamp.getTime() < CACHE_EXPIRY_TIME) {
      // Removed: return data;
      // Removed: }
      */
    }
    return null;
  } catch (error) {
    console.error("獲取 HTML 內容時出錯:", error);
    return null;
  }
}

// No more functions after this point
