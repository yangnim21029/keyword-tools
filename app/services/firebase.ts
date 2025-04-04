// Firebase 配置和初始化
import { App, cert, getApps, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

// 初始化 Firebase Admin
let app: App | undefined;
export let db: Firestore | undefined;

// 确保 Firebase Admin 只初始化一次
if (typeof process !== 'undefined' && !getApps().length) {
  try {
    // 检查必要的环境变量是否存在
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      console.error("Firebase 環境變量未設置，請在 .env.local 中配置 FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY 和 FIREBASE_CLIENT_EMAIL");
    }
    
    // 从环境变量获取 Firebase 凭证
    const serviceAccount: Partial<ServiceAccount> = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
      throw new Error("Missing essential Firebase Admin credentials in environment variables.");
    }

    app = initializeApp({
      credential: cert(serviceAccount as ServiceAccount),
      databaseURL: `https://${serviceAccount.projectId}.firebaseio.com`
    });
    
    db = getFirestore(app);
    console.log("Firebase Admin SDK 初始化成功");
  } catch (error) {
    console.error("Firebase Admin SDK 初始化錯誤", error);
  }
} else if (getApps().length > 0) {
  app = getApps()[0];
  db = getFirestore(app);
} else {
    console.warn("Firebase Admin SDK not initialized (not in Node.js env or already initialized elsewhere).");
}

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
