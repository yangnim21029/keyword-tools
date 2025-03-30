import { revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { tags = [] } = await request.json()
    
    if (!Array.isArray(tags) || tags.length === 0) {
      return Response.json({ 
        success: false, 
        message: '需要提供至少一個標籤進行刷新' 
      }, { status: 400 })
    }
    
    // 遍歷所有標籤並重新驗證
    for (const tag of tags) {
      if (typeof tag === 'string' && tag.trim() !== '') {
        console.log(`[API] 重新驗證標籤: ${tag}`)
        revalidateTag(tag)
      }
    }
    
    return Response.json({ 
      success: true, 
      message: `已重新驗證 ${tags.length} 個標籤`,
      revalidated: true, 
      timestamp: Date.now() 
    })
  } catch (error) {
    console.error('[API] 重新驗證標籤時出錯:', error)
    return Response.json({ 
      success: false, 
      message: '重新驗證標籤時出錯' 
    }, { status: 500 })
  }
} 