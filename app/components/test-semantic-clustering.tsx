'use client'

import { useState } from 'react'
import { performSemanticClustering } from '../actions/semantic-clustering'

export default function TestSemanticClustering() {
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const testKeywords = [
    "SEO优化",
    "内容营销",
    "关键词研究",
    "网站分析",
    "用户体验",
    "社交媒体营销",
    "电子邮件营销",
    "品牌建设",
    "转化率优化",
    "网站性能"
  ]

  const handleTest = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await performSemanticClustering(testKeywords)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <button
        onClick={handleTest}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
      >
        {loading ? '测试中...' : '测试语义分群'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <h3 className="font-bold mb-2">分群结果：</h3>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
} 