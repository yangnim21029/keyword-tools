import {
  htmlAnalysisResultSchema,
  type HtmlAnalysisResult
} from '@/lib/schemas/serp.schema';
import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db } from './config';

/**
 * 更新历史记录中的HTML分析结果
 * 由于SERP缓存集合已被移除，此函数将HTML分析保存到历史文档中
 */
export async function updateSerpResultWithHtmlAnalysis(documentId: string, keyword: string, url: string, htmlAnalysis: HtmlAnalysisResult) {
  if (!db) {
    console.log('[updateSerpResultWithHtmlAnalysis] Firebase db未初始化');
    return;
  }

  try {
    // 验证传入的htmlAnalysis数据
    const validationResult = htmlAnalysisResultSchema.safeParse(htmlAnalysis);
    if (!validationResult.success) {
      console.error(`[updateSerpResultWithHtmlAnalysis] 提供的HTML分析数据验证失败 (URL: ${url}):`, validationResult.error.format());
      return;
    }
    const validatedAnalysisData = validationResult.data;

    // Use the correct collection name
    const docRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(documentId);
    
    // 添加分析到文档的serpAnalysis字段
    await docRef.update({
      [`serpAnalysis.${keyword}.${encodeURIComponent(url)}`]: {
        ...validatedAnalysisData,
        lastUpdated: Timestamp.now()
      }
    });
    
    console.log(`[updateSerpResultWithHtmlAnalysis] 已更新文档${documentId}中关键词${keyword}的URL ${url}的HTML分析`);
  } catch (error) {
    if (error instanceof Error && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('Quota exceeded'))) {
      console.warn(`[updateSerpResultWithHtmlAnalysis] Firebase配额超出，无法更新${url}的HTML分析。`);
    } else {
      console.error(`[updateSerpResultWithHtmlAnalysis] 更新HTML分析时出错 (URL: ${url}):`, error);
    }
  }
} 