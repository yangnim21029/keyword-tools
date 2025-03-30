'use server';

import { db } from '@/app/services/firebase/config';
import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * 根據 URL 生成確定性文檔 ID
 * @param url 頁面 URL
 * @returns 哈希後的文檔 ID
 */
function generateDocId(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex');
}

/**
 * 將頁面的 Markdown 內容保存到 pageContents 集合
 * @param url 頁面 URL
 * @param markdown 處理過的 Markdown 內容
 * @returns 成功時返回文檔引用路徑，失敗時返回 null
 */
export async function savePageContent(url: string, markdown: string): Promise<string | null> {
  try {
    if (!url || typeof markdown !== 'string') {
      console.error('[savePageContent] 無效的輸入參數', { url, markdownType: typeof markdown });
      return null;
    }

    if (!db) {
      console.error('[savePageContent] Firebase db 未初始化');
      return null;
    }

    // 生成確定性的文檔 ID
    const docId = generateDocId(url);
    
    // 準備保存的數據
    const data = {
      url,
      markdown,
      lastAnalyzed: Timestamp.now()
    };

    // 保存到 pageContents 集合
    const docRef = db.collection('pageContents').doc(docId);
    await docRef.set(data, { merge: true });
    
    // 返回文檔引用路徑
    return `pageContents/${docId}`;
  } catch (error) {
    console.error('[savePageContent] 保存頁面內容時出錯', error);
    return null;
  }
}

/**
 * 通過引用路徑獲取頁面內容
 * @param contentRef 引用路徑，格式為 "pageContents/{docId}"
 * @returns 包含 markdown 的對象，或 null
 */
export async function getPageContent(contentRef: string): Promise<{ markdown: string } | null> {
  try {
    if (!contentRef || !contentRef.startsWith('pageContents/')) {
      console.error('[getPageContent] 無效的 contentRef', contentRef);
      return null;
    }

    if (!db) {
      console.error('[getPageContent] Firebase db 未初始化');
      return null;
    }

    // 從引用路徑中提取文檔 ID
    const docId = contentRef.split('/')[1];
    
    // 獲取文檔
    const docSnap = await db.collection('pageContents').doc(docId).get();
    
    if (!docSnap.exists) {
      console.error('[getPageContent] 找不到指定的內容文檔', { contentRef });
      return null;
    }

    const data = docSnap.data();
    return {
      markdown: data?.markdown || ''
    };
  } catch (error) {
    console.error('[getPageContent] 獲取頁面內容時出錯', error);
    return null;
  }
} 