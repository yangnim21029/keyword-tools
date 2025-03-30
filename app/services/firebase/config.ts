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

// 緩存相關常量
export const CACHE_EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000; // 7天的毫秒數

// 只保留實際使用的集合
export const COLLECTIONS = {
  SEARCH_HISTORY: 'searchHistory',
  SERP_RESULTS: 'serpResults'
};

/**
 * Firebase 文檔結構說明:
 * 
 * 1. searchHistory 集合:
 *    - 文檔ID: 自動生成
 *    - 字段:
 *      - mainKeyword: 主關鍵詞
 *      - region: 地區代碼
 *      - language: 語言代碼
 *      - suggestions: 關鍵詞建議數組
 *      - searchResults: 搜索量結果數組
 *      - timestamp: 搜索時間戳
 * 
 * 2. serpResults 集合:
 *    - 緩存搜索引擎結果頁面數據
 */

// 導出 Firebase 實例
export { db };
export type { Firestore };

