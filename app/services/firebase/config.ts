// Firebase 配置和初始化
import {
  App,
  cert,
  getApps,
  initializeApp,
  ServiceAccount
} from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

// 初始化 Firebase Admin
let app: App | undefined;
let db: Firestore | undefined;

// 確保 Firebase Admin 只初始化一次
if (!getApps().length) {
  try {
    // 檢查必要的環境變量是否存在
    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_PRIVATE_KEY ||
      !process.env.FIREBASE_CLIENT_EMAIL
    ) {
      console.error(
        'Firebase 環境變量未設置，請在 .env.local 中配置 FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY 和 FIREBASE_CLIENT_EMAIL'
      );
    }

    // Explicitly type serviceAccount as Partial<ServiceAccount> or ServiceAccount
    // Using Partial because some fields might be missing depending on env vars
    const serviceAccount: Partial<ServiceAccount> = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      // Add other necessary fields if available, otherwise rely on Partial
      // clientId: process.env.FIREBASE_CLIENT_ID,
      // client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    };

    // Check if essential fields are present before casting
    if (
      !serviceAccount.projectId ||
      !serviceAccount.privateKey ||
      !serviceAccount.clientEmail
    ) {
      throw new Error(
        'Missing essential Firebase Admin credentials in environment variables.'
      );
    }

    app = initializeApp({
      // Cast to ServiceAccount after checking essential fields
      credential: cert(serviceAccount as ServiceAccount),
      databaseURL: `https://${serviceAccount.projectId}.firebaseio.com`
    });

    db = getFirestore(app);
    console.log('Firebase Admin SDK 初始化成功');
  } catch (error) {
    console.error('Firebase Admin SDK 初始化錯誤', error);
  }
} else {
  app = getApps()[0];
  db = getFirestore(app);
}

// 只保留實際使用的集合
export const COLLECTIONS = {
  KEYWORD_RESEARCH: 'keyword-research',
  SERP: 'serp'
} as const;

// 導出 Firebase 實例
export { db };
export type { Firestore };
