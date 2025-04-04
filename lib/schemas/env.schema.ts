/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from 'zod';

/**
 * 定義所有可能的環境變數和驗證規則
 */
export const envSchema = z.object({
  // API Keys 和訪問憑證
  APIFY_API_TOKEN: z.string().min(1, "Apify API Token 為必填項"),
  APIFY_ACTOR_ID: z.string().min(1, "Apify Actor ID 為必填項"),
  FIREBASE_API_KEY: z.string().optional(),
  FIREBASE_AUTH_DOMAIN: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().min(1, "Firebase Project ID 為必填項"),
  FIREBASE_STORAGE_BUCKET: z.string().min(1, "Firebase Storage Bucket 為必填項"),
  FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, "Firebase Messaging Sender ID 為必填項"),
  FIREBASE_APP_ID: z.string().optional(),
  
  // 可選環境變數，有合理的預設值
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DEBUG: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // 應用配置
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  API_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
}).partial({
  // 這些字段在開發模式下是可選的
  NEXT_PUBLIC_APP_URL: true,
  FIREBASE_STORAGE_BUCKET: true,
  FIREBASE_MESSAGING_SENDER_ID: true
});

// 推導環境變數類型
export type Env = z.infer<typeof envSchema>;

/**
 * 驗證所有環境變數並在失敗時拋出詳細錯誤
 * 
 * 主要用於應用啟動時確保所有必要環境變數都存在
 * @returns 驗證後的環境變數
 * @throws Error 如果驗證失敗
 */
export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  
  if (!parsed.success) {
    const formatted = parsed.error.format();
    console.error('❌ 環境變數驗證失敗:');
    
    // 創建更易讀的錯誤訊息
    const errorMessages = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, value]) => {
        const errors = (value as Record<string, string[]>)._errors;
        return `${key}: ${errors.join(', ')}`;
      });
    
    console.error(errorMessages.join('\n'));
    throw new Error('環境變數驗證失敗，請檢查 .env 檔案');
  }
  
  return parsed.data;
}

/**
 * 安全地獲取環境變數，不會拋出錯誤
 * 
 * 適用於不影響核心功能的環境變數存取
 * @returns 驗證後的環境變數，或在驗證失敗時返回原始 process.env
 */
export function safeGetEnv(): Record<string, string | undefined> {
  const parsed = envSchema.safeParse(process.env);
  
  if (!parsed.success) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ 環境變數驗證警告:');
      console.warn(parsed.error.format());
    }
    return process.env;
  }
  
  // 將數字類型的值轉換為字符串，確保與 process.env 類型一致
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) {
      result[key] = undefined;
    } else {
      result[key] = String(value);
    }
  }
  
  return result;
}

/**
 * 獲取特定環境變數並進行類型安全的訪問
 * 
 * @param key 環境變數名稱
 * @param defaultValue 可選的預設值
 * @returns 環境變數值，如果不存在則返回預設值
 */
export function getEnvVar<K extends keyof Env>(
  key: K, 
  defaultValue?: Env[K]
): Env[K] | undefined {
  const env = safeGetEnv();
  const value = env[key];
  
  // 根據 Env 類型定義，將字符串轉換為適當的類型
  if (key === 'API_TIMEOUT_MS') {
    return value ? Number(value) as Env[K] : defaultValue;
  }
  
  return (value as unknown as Env[K]) || defaultValue;
}

// --- Additional helper for client-side access ---

// Helper to parse potentially undefined/empty strings to numbers or keep undefined
const parseOptionalInt = (val: string | undefined): number | undefined => {
  if (val === undefined || val === '') return undefined;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? undefined : parsed;
};

export const clientEnv = {
  // Subset of env variables safe for client-side
  NEXT_PUBLIC_APP_URL: envSchema.shape.NEXT_PUBLIC_APP_URL,
  // Example: Add other NEXT_PUBLIC variables if needed
  // Add non-public variables ONLY if absolutely necessary and safe,
  // but it's generally better to handle them server-side.
};

// Example of validating a nested object (like FIREBASE_SERVICE_ACCOUNT)
const serviceAccountSchema = z.object({
    type: z.string().optional(),
    project_id: z.string().optional(),
    private_key_id: z.string().optional(),
    private_key: z.string().optional(),
    client_email: z.string().optional(),
    client_id: z.string().optional(),
    auth_uri: z.string().optional(),
    token_uri: z.string().optional(),
    auth_provider_x509_cert_url: z.string().optional(),
    client_x509_cert_url: z.string().optional(),
    universe_domain: z.string().optional(),
}).passthrough(); // Allow extra fields if present

// Example of parsing a JSON string from env variable
const parsedServiceAccount = z.preprocess(
  (val: unknown) => {
    if (typeof val === 'string' && val) {
      try {
        return JSON.parse(val);
      } catch (e) {
        console.error('❌ 解析 FIREBASE_SERVICE_ACCOUNT 失敗:', e);
        return undefined;
      }
    }
  },
  serviceAccountSchema
); 