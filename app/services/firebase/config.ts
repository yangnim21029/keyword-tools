// Firebase 配置和初始化
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

// 初始化 Firebase Admin
let app: App | undefined;
let db: Firestore | undefined;

// 確保 Firebase Admin 只初始化一次
if (!getApps().length) {
  try {
    // 檢查必要的環境變量是否存在
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      console.error("Firebase 環境變量未設置，請在 .env.local 中配置 FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY 和 FIREBASE_CLIENT_EMAIL");
    }
    
    // 從環境變量獲取 Firebase 憑證
    const serviceAccount = {
      "type": "service_account",
      "project_id": "seo-preogic",
      "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
      "private_key": process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      "client_email": "firebase-adminsdk-fbsvc@seo-preogic.iam.gserviceaccount.com",
      "client_id": "106865783745185249700",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40seo-preogic.iam.gserviceaccount.com",
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

// 緩存相關常量
export const CACHE_EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000; // 7天的毫秒數

// 只保留實際使用的集合
export const COLLECTIONS = {
  KEYWORD_RESEARCH: 'keywordResearch',
  SERP_RESULTS: 'serpResults',
  HTML_CONTENTS: 'htmlContents',
  MARKDOWN: 'markdown'
};

/**
 * Firebase 文檔結構說明:
 * 
 * 1. keywordResearch 集合:
 *    - 文檔ID: 自動生成
 *    - 字段:
 *      - mainKeyword: 主關鍵詞
 *      - region: 地區代碼
 *      - language: 語言代碼
 *      - suggestions: 關鍵詞建議數組
 *      - searchResults: 搜索結果數組
 *      - clusters: 分群結果
 *      - timestamp: 創建時間戳
 * 
 * 2. serpResults 集合:
 *    - 緩存搜索引擎結果頁面數據
 * 
 * 3. htmlContents 集合:
 *    - 緩存網頁 HTML 內容
 * 
 * 4. markdown 集合:
 *    - 存儲 Markdown 格式的內容
 */

// 導出 Firebase 實例
export { db };
export type { Firestore };

