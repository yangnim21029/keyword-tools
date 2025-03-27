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

  // 加载历史数据
  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        const history = await fetchSearchHistory(50);
        setHistoryList(history);
        setError(null);
      } catch (err) {
        console.error('加載歷史記錄失敗', err);
        setError('無法加載歷史記錄');
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
      setError('載入歷史記錄詳情失敗');
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
      const history = await fetchSearchHistory(50);
      setHistoryList(history);
      setError(null);
    } catch (err) {
      console.error('刷新歷史記錄失敗', err);
      setError('刷新歷史記錄失敗');
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
          className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
        >
          刷新
        </button>
      </div>
      
      {/* 历史记录列表 */}
      <div className="flex-grow overflow-y-auto">
        {loading && historyList.length === 0 ? (
          <div className="flex justify-center items-center h-20">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
            <p>加載中...</p>
          </div>
        ) : error ? (
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