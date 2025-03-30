import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Missing ID parameter' }, { status: 400 });
    }
    
    // 導入Firebase函數
    const { getSearchHistoryDetail } = await import('@/app/services/firebase/history');
    console.log(`[API] 嘗試獲取歷史記錄 ID: ${id}`);
    
    // 獲取歷史記錄詳情
    const result = await getSearchHistoryDetail(id);
    
    if (!result) {
      return NextResponse.json({ error: 'History not found' }, { status: 404 });
    }
    
    console.log(`[API] 歷史記錄獲取成功，clusters數據:`, {
      hasClusters: !!result.clusters,
      clusterKeys: result.clusters ? Object.keys(result.clusters).length : 0
    });
    
    // 返回包含clusters的對象
    return NextResponse.json({
      id: result.id,
      mainKeyword: result.mainKeyword,
      clusters: result.clusters || null,
      clustersCount: result.clusters ? Object.keys(result.clusters).length : 0,
    });
  } catch (error) {
    console.error('[API] 獲取聚類數據失敗:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 