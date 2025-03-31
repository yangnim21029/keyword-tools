"server only";  
// Firebase 配置和初始化
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore, Timestamp } from 'firebase-admin/firestore';

// Firebase Admin 凭证（从环境变量加载）
const serviceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID || "seo-preogic",
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@seo-preogic.iam.gserviceaccount.com",
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL,
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
  KEYWORD_RESEARCH: 'keywordResearch',
  SERP_RESULTS: 'serpResults',
  HTML_CONTENTS: 'htmlContents',
  MARKDOWN: 'markdown'
};

// 生成 URL 的哈希值作為文檔 ID
function generateUrlHash(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// 保存 HTML 內容到 Firebase
export async function saveHtmlContent(url: string, content: any) {
  if (!db) return;
  
  try {
    const docId = generateUrlHash(url);
    const docRef = db.collection(COLLECTIONS.HTML_CONTENTS).doc(docId);
    
    await docRef.set({
      ...content,
      timestamp: Timestamp.now(),
      url: url,
      docId: docId
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
    const docId = generateUrlHash(url);
    const docRef = await db.collection(COLLECTIONS.HTML_CONTENTS).doc(docId).get();
    
    if (docRef.exists) {
      const data = docRef.data();
      if (!data) return null;
      
      if (data.url !== url) {
        console.warn(`URL 不匹配: 期望 ${url}, 實際 ${data.url}`);
        return null;
      }
      
      const timestamp = data.timestamp.toDate();
      const now = new Date();
      
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
    
    const results = serpData.results[keyword].results;
    const resultIndex = results.findIndex((r: any) => r.url === url);
    
    if (resultIndex === -1) {
      console.error('找不到對應的搜索結果:', url);
      return;
    }
    
    const analysisToSave = {
      h1: htmlAnalysis.h1,
      h2: htmlAnalysis.h2,
      h3: htmlAnalysis.h3,
      h1Consistency: htmlAnalysis.h1Consistency,
    };
    
    results[resultIndex].htmlAnalysis = analysisToSave;
    
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

// 通過 ID 獲取搜索結果
export async function getKeywordResearchById(serpId: string) {
  if (!db) return null;
  
  try {
    const serpRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(serpId);
    const serpDoc = await serpRef.get();
    
    if (!serpDoc.exists) {
      console.warn(`找不到 SERP 結果文檔: ${serpId}`);
      return null;
    }
    
    const data = serpDoc.data();
    if (!data) {
      console.warn(`SERP 結果文檔數據為空: ${serpId}`);
      return null;
    }
    
    // 檢查緩存是否過期
    const timestamp = data.timestamp?.toDate() || new Date(0);
    const now = new Date();
    
    if (now.getTime() - timestamp.getTime() > CACHE_EXPIRY_TIME) {
      console.warn(`SERP 結果已過期: ${serpId}`);
      return null;
    }
    
    return {
      id: serpDoc.id,
      type: 'keyword',
      ...data,
      timestamp: timestamp,
      lastUpdated: data.lastUpdated?.toDate() || timestamp
    };
  } catch (error) {
    console.error('獲取 SERP 結果時出錯:', error);
    throw error;
  }
}

export { db };
