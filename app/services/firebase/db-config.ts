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

// 放 .env 格式會有問題，直接放這
const FIREBASE_PRIVATE_KEY =
  "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCnbNQnlYL53iRa\n4fSy89KRHeSrEIldtpmm7/PEQ8HIxJRmssyMemdcckPuyfZq6UPDs95DReWx97N/\nk10EisTKgc/TkXTI/YE38M+xI2SaPBvoYA1O6c0cVI21bJDjj2MkrPjuf3nkMRzC\nCLeIefBS0kkv0Q2n2aJaB0zBZ9oQXv2HgwM8wwYOMXEE/DHIaYJJdAGd8ExRpd4N\nfCZngWj6CNDPiTRozAnHWlNwRzT0MktGiXwQ0tL2/7PPTOjdmYJeZPCZk5/6e+W/\nJy1d0hR+YrVxWGDCV9EOr1T4YxDSrcUOABa93wxVluTQ/3FQ3HSzE6+koqfqO9LN\nzohx++nvAgMBAAECggEALgdX7kgG+a3uXcQIM5if18CZqMQDl+2HIaOPZ3JfWNRe\nnjtiy+4s83gAoCoLIopd1HRjUyhoxTw9r4GyjXifMLNukRJIwqcbOudsGh2KX3LO\nE10w23SgrLy8NtgRn1ZA4gjh6SPHvYoZB2lBF/a6MPLaJxi4weAt58Vg/z0PcPdS\nqeFKYSGPJmmKnDnDiMiVfzppo5wyR7Ss2aR6piYYe0YK445qxQv7jgSLOSmEiMxu\nfAMsAL+1mv4ZfUAhbRcMXackKHEFAEsJ3ubK7w5/y1NVlnP1PAlIwcuHumXz97SJ\nuX66Hke+6sL59xZO1agNhpRlaftx0/n9t01y3f0QBQKBgQDUcXLJvKR3/rylA2Br\nH/4KaF2RMaASgVTtaqHaq1MSLwGWTejt5u1tJgJInqvTri1ZGYLcuZtYxJTLiKCL\n3MCvX3n+sV0GXtJYSxl42tL27qvjR8hgqIJSsoPcQ1FbhFnqRFDO/s4kebeXzdoZ\nRqoAmHSzhdWXYrSkOBaLkXZHewKBgQDJwIISqbN9lgy9xdQSuNCK/DEEkuffrU6q\ndNATaxGfOrowMIxtwi/9Mpv58YBcIfdJppc+FAIHAapnq7jHaC2QU7pG2AGNwsqt\nWE8uCACd2DB9IMfzUDzZNu6+lAK/qWHO7GANdMz1UjynaZIGbzEqQtFW677AlkAj\nHyA5snAjHQKBgQCsqMeyTi8dl1uagXQLnKTLsKbbKon+gD6V9uQ05KlPTgTsM8Xs\nFJNC8nFItCzSje0tTR6eZftr2dlU0mYpRfEUl3R/G4ePdeFfASpinvZ22uO4hM7G\nQC4rKAsjKVMmHhs12vASS+UeoA4mwpdPk673bPDsNwmxT/egwDUSmdaXoQKBgHqL\n9HZhniUqf5LGF4tHt2S0yxF8KlwzaRUg30LsRkfx5CZhVutUiNHDa/rmNpHAD/Us\nu7F5dcHLwTY3mIWHQiXotb1Sd58kMvgYLABJ3BYEu29F+i5RDqTiOSKJxSGmQULv\nUWjbCaP5z93gwlImODbzXzTs/XD90veCcJCbUoIBAoGBAJccyS3Pw6AF9NOEIeth\nbFr1EWGwbyyHkS5Cqwrmc7viYCSoMAhOm3/xEHqw13kgUob1LKl5iiTk1aUtaBWu\n5qxRSKXVf7A6bCv0jdT30X9hSBDgqN7Q4snan0v+qgeqNDtvOxCIUhkrZk3CJ5CX\nLODBBlAR8Xq4jXApGFPrSNR8\n-----END PRIVATE KEY-----\n";

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
        "Firebase 環境變量未設置，請在 .env.local 中配置 FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY 和 FIREBASE_CLIENT_EMAIL"
      );
    }

    // Explicitly type serviceAccount as Partial<ServiceAccount> or ServiceAccount
    // Using Partial because some fields might be missing depending on env vars
    const serviceAccount: Partial<ServiceAccount> = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
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
        "Missing essential Firebase Admin credentials in environment variables."
      );
    }

    app = initializeApp({
      // Cast to ServiceAccount after checking essential field
      credential: cert(serviceAccount as ServiceAccount),
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
  ADVICES: "advices",
} as const;

export { db };
export type { Firestore };
