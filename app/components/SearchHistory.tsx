'use client';

import { useState, useEffect } from 'react';
import { fetchSearchHistory, fetchSearchHistoryDetail } from '../actions';

// 搜索历史列表项的类型
interface SearchHistoryItem {
  id: string;
  mainKeyword: string;
  region: string;
  language: string;
  timestamp: Date;
  suggestionCount: number;
  resultsCount: number;
}

// 搜索历史组件的属性
interface SearchHistoryProps {
  onSelectHistory: (historyDetail: any) => void;
}

export default function SearchHistory({ onSelectHistory }: SearchHistoryProps) {
  const [historyList, setHistoryList] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  // 加载历史数据
  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        const history = await fetchSearchHistory(50);
        setHistoryList(history);
        setError(null);
        setQuotaExceeded(false);
      } catch (err) {
        console.error('加載歷史記錄失敗', err);
        
        // 檢查是否是配額問題
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isQuotaError = errorMessage.includes('RESOURCE_EXHAUSTED') || 
                             errorMessage.includes('Quota exceeded');
        
        if (isQuotaError) {
          console.log('Firebase 配額已用盡，歷史記錄功能暫時不可用');
          setQuotaExceeded(true);
          setError('Firebase 配額已用盡，歷史記錄功能暫時不可用');
        } else {
          setError('無法加載歷史記錄');
        }
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  // 处理点击历史记录
  const handleSelectHistory = async (historyId: string) => {
    try {
      setLoading(true);
      const historyDetail = await fetchSearchHistoryDetail(historyId);
      if (historyDetail) {
        onSelectHistory(historyDetail);
      } else {
        setError('無法載入該歷史記錄');
      }
    } catch (err) {
      console.error('載入歷史記錄詳情失敗', err);
      
      // 檢查是否是配額問題
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isQuotaError = errorMessage.includes('RESOURCE_EXHAUSTED') || 
                           errorMessage.includes('Quota exceeded');
      
      if (isQuotaError) {
        setQuotaExceeded(true);
        setError('Firebase 配額已用盡，歷史記錄功能暫時不可用');
      } else {
        setError('載入歷史記錄詳情失敗');
      }
    } finally {
      setLoading(false);
    }
  };

  // 格式化时间
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // 刷新历史记录
  const refreshHistory = async () => {
    try {
      setLoading(true);
      setQuotaExceeded(false);
      const history = await fetchSearchHistory(50);
      setHistoryList(history);
      setError(null);
    } catch (err) {
      console.error('刷新歷史記錄失敗', err);
      
      // 檢查是否是配額問題
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isQuotaError = errorMessage.includes('RESOURCE_EXHAUSTED') || 
                           errorMessage.includes('Quota exceeded');
      
      if (isQuotaError) {
        setQuotaExceeded(true);
        setError('Firebase 配額已用盡，歷史記錄功能暫時不可用');
      } else {
        setError('刷新歷史記錄失敗');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 历史记录标题 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h2 className="text-lg font-semibold">搜索歷史</h2>
        <button 
          onClick={refreshHistory}
          disabled={loading}
          className={`text-sm ${loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white px-2 py-1 rounded`}
        >
          {loading ? '加載中...' : '刷新'}
        </button>
      </div>
      
      {/* 历史记录列表 */}
      <div className="flex-grow overflow-y-auto">
        {loading && historyList.length === 0 ? (
          <div className="flex justify-center items-center h-20">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
            <p>加載中...</p>
          </div>
        ) : quotaExceeded ? (
          <div className="p-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Firebase 配額已用盡，歷史記錄功能暫時不可用。
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    您可以繼續使用其他功能。配額將在下個計費週期重置。
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : error && !quotaExceeded ? (
          <div className="p-4 text-red-500">{error}</div>
        ) : historyList.length === 0 ? (
          <div className="p-4 text-gray-500">暫無搜索歷史記錄</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {historyList.map((item) => (
              <li 
                key={item.id}
                className="hover:bg-blue-50 transition-colors cursor-pointer"
                onClick={() => handleSelectHistory(item.id)}
              >
                <div className="p-3">
                  <div className="font-medium truncate">{item.mainKeyword}</div>
                  <div className="text-sm text-gray-500 flex justify-between mt-1">
                    <span>{item.region} | {item.language}</span>
                    <span>{formatDate(item.timestamp)}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    <span>{item.suggestionCount} 個關鍵詞</span>
                    {item.resultsCount > 0 && (
                      <span className="ml-2">{item.resultsCount} 個搜索結果</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 