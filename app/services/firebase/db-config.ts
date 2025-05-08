import "server-only";

// Firebase 配置和初始化
import {
  App,
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";

// 初始化 Firebase Admin
let app: App | undefined;
let db: Firestore | undefined;

const FIREBASE_CREDENTIALS = {
  type: "service_account",
  project_id: "seo-preogic",
  private_key_id: "e25909a4b4c70a3a6f19f80cad118720cc933924",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQChLMT/8I6999w8\n3x7rOFyT2roXDFG/WJIJmwD4GWxZM2p2yqYBx6g5r9NAWmJO3c661OBCLnbP8V4l\nDgdEsRKLBNAS7HDrXYcu98s8jYg+BY3wyf1ZlM+cAzUMb2Yj41CQUi3pg67vGBmM\nVcko2DyUuNlz2VmQlrun8k07gvTosckZBJqOV/UdQHU4nqQQjnjYjEy7T95nVHqb\nEVTVHfK+IlIAzIc+DtAP0R6H5hkE/yLkNzjf6SkoRQr+hmnYjG7VKvchjxvr96LU\nwwlYfQkf+SqrPgVWzPBMrDY58I1vmLIxqCwc86oidPdnZfqxN2oeXx7R90ilNPP6\npFTaHagfAgMBAAECggEAKroBEW5WkOKrtlFZ03ZyCFokGecQpr6WnEhElgC7WdxI\n/WvUXUVuAbjsMjOjuw+O9bVoK/NAWPi+Aem5oIqmhUcF1/ZpKuP06c0Tyh4k/3ge\nfDY33O8XqF6rSfwgIiRpH5FBjZV0ovqLD0pQlOzaBn0IXG9CkJN89NVFhyC8xxCq\nLEJVxYfaPUy0DhjDrzszmHCiOewSB4wGBYuKxUdSWwCnuOdhO3trxOYtoNOLVXr7\n8yiIZGS++iNxa3gRlrGW8jc/5I/GrYTpG5389tjDozmbl+ehRFCZcYw/H+PStMtB\nf5o5P2thGzlOgBc9pGWh9Y8bJFM/tX3pCovGkPt2oQKBgQDgIKGBZAtgsNl7AA1o\nLCmeooREaurnrcpK45yNf1GwyI0wICXQQMCROQ6OQMDweNJ4kIFugrfuOYnZ/k9o\neZGVAl6MZky1KT1C/AgKhQbaI6jHsWJty25YCcCELMnLmNCmqBkgiY504Yr9TIv+\nfglJB6qXbe3LMkqrxk9gU0haPwKBgQC4GFjuPnCvIstCWia3nYjcMNsh2V/utQey\n5u6CBiGb0QKJeqOD6Y7xipKyPgHBRr7Uv0irSA2DpuJVlPzhyFGBfzBRts6QvI9i\nBuimn83wRfLwe/U6fj/4sWiu7tHrI8Pzp2L9UUUQJEj0vioNW1235GBlXHFXqD8+\nettO2zh6IQKBgQClCEIEJaefFfm98Ubt+v7WeXKNcnDwEW8Qf9Mp+aMsWjBkTHer\nhdKF3I6UPqgTKdRIxJcZyZUoDCQuaW0NT97b6ve1yCoZh3k9lplRLazi+TjxefMx\nR4dDukKQ0O3yRd71qHeAFunXtLAEXdYDmci6hrOdd2uOoMSNAaQ3GHwBPwKBgF/T\nvKb3NazUjb1SNAksJYuImuh5wGf/L6y+bLSeAGydVZa+kdMehlvQ6B+EC2HSM4+G\nqosODIrVGce2sBPPNC4WSM6gO9I3dONv+TaSxJ4nqxfnTnVONnp7zqQQiJC/o0Z3\ngR2fajXGzXsoabdeMeCBLnRUtGMOny0kwne/wRxBAoGBANK7QC+cmAJvbtzaooEx\nKFjkkAKpRDWFTa1pbPw44Sk4BTnHPh0QrrtV2YkEd6YWtge7MOXgtbc1vKkJWW5/\n1GPqD87VaOpubqDsmQSEEZHcurSnQpllZh864EVdIeEsgEt48fRT0C/OqWjfKmur\nk3ZNwBTfgV4RoVHLA4Hty5xM\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@seo-preogic.iam.gserviceaccount.com",
  client_id: "106865783745185249700",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40seo-preogic.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

// 確保 Firebase Admin 只初始化一次
if (!getApps().length) {
  try {
    const serviceAccount: ServiceAccount = {
      projectId: FIREBASE_CREDENTIALS.project_id,
      privateKey: FIREBASE_CREDENTIALS.private_key.replace(/\n/g, "\n"),
      clientEmail: FIREBASE_CREDENTIALS.client_email,
    };

    app = initializeApp({
      credential: cert(serviceAccount),
      databaseURL: `https://${serviceAccount.projectId}.firebaseio.com`,
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

export const COLLECTIONS = {
  KEYWORD_VOLUME: "keyword_volume",
  SERP_RESULT: "serp_result",
  ONPAGE_RESULT: "on_page_result",
  AI_WRITING_QUEUE: "ai_writing_queue",
  OPPORTUNITY: "opportunity",
  PROCESSED_OPPORTUNITY: "processed_opportunities",
  UNAVAILABLE_URLS: "unavailable_urls",
} as const;

export { db };
export type { Firestore };
