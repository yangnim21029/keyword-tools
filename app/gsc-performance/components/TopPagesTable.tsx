import React from 'react';
import Image from 'next/image';
import { DataTable } from './data-table';
import { KeywordTags } from './keyword-tags';

// Define the expected data structure for a row
// Using the ProcessedPageData type definition from the original page context
type ProcessedPageData = {
  site_id: string;
  url: string;
  impressionShare: number;
  total_clicks: number;
  total_impressions: number;
  ctr: number;
  avg_position: number;
  keyword_count: number;
  keywords: string[];
  top_keyword: string;
  displayText: string;
  total_pages: number;
};

type TopPagesTableProps = {
  data: ProcessedPageData[];
  faviconUrlCache: Map<string, string>;
};

export function TopPagesTable({ data, faviconUrlCache }: TopPagesTableProps) {
  const columns = [
    { key: 'rank', label: '排名' },
    { key: 'site', label: '網站' },
    { key: 'page', label: '頁面' },
    { key: 'impressionShare', label: '單頁面全站展示佔比 (%)' },
    { key: 'topKeyword', label: '最高流量詞' },
    { key: 'keywordCount', label: '關鍵字數' },
    { key: 'keywords', label: '關鍵字 (依展示排序)' },
    { key: 'totalPages', label: '總頁數' }
  ];

  return (
    <DataTable
      title="各站最高流量頁面"
      columns={columns}
      data={data}
      headerClassName="bg-gray-100"
      renderRow={(item, index) => (
        <tr key={index} className="hover:bg-gray-50 text-sm border-b border-gray-200">
          <td className="px-4 py-1.5 text-right font-mono text-gray-700">{index + 1}</td>
          <td className="px-4 py-1.5 text-gray-700 font-mono">{item.site_id}</td>
          <td className="px-4 py-1.5">
            <div className="flex items-center gap-2">
              {faviconUrlCache.get(item.url) && (
                <Image
                  src={faviconUrlCache.get(item.url) || ''}
                  alt=""
                  width={16}
                  height={16}
                  className="w-4 h-4 flex-shrink-0"
                  loading="lazy"
                />
              )}
              <a 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[200px] font-mono"
              >
                {item.displayText}
              </a>
            </div>
          </td>
          <td className="px-4 py-1.5 text-right font-mono text-gray-700">{item.impressionShare.toFixed(1)}%</td>
          <td className="px-4 py-1.5 text-gray-700 font-mono">{item.top_keyword}</td>
          <td className="px-4 py-1.5 text-right">
            <div className="flex items-center justify-end gap-1">
              <span className={`h-2 w-2 rounded-full ${item.keyword_count > 30 ? "bg-yellow-500" : item.keyword_count > 20 ? "bg-yellow-400" : item.keyword_count > 10 ? "bg-yellow-300" : "bg-yellow-200"}`}></span>
              <span className="font-mono text-yellow-600 text-xs">{item.keyword_count}</span>
            </div>
          </td>
          <td className="px-4 py-1.5 min-w-[200px]">
            <KeywordTags keywords={item.keywords.slice(0, 10)} />
          </td>
          <td className="px-4 py-1.5 text-right font-mono text-xs text-gray-500">
            {item.total_pages}
          </td>
        </tr>
      )}
    />
  );
} 