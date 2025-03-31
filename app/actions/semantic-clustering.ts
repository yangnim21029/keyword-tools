'use server'

import { z } from 'zod'

const clusterSchema = z.object({
  clusters: z.record(z.string(), z.array(z.string()))
})

export async function performSemanticClustering(keywords: string[]) {
  try {
    console.log('[Server Action] 收到語意分群請求')
    
    if (!keywords || !Array.isArray(keywords) || keywords.length < 5) {
      throw new Error('至少需要5个关键词进行分群')
    }

    // 如果没有VERCEL_URL，则使用本地开发环境的URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
      
    const response = await fetch(`${baseUrl}/api/semantic-clustering`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords,
        model: 'gpt-4o-mini'
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || '分群请求失败')
    }

    const result = await response.json()
    console.log('[Server Action] 收到分群結果:', JSON.stringify(result, null, 2))
    
    return clusterSchema.parse(result)
  } catch (error) {
    console.error('[Server Action] 語意分群錯誤:', error)
    throw error
  }
} 