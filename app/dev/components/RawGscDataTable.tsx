import React from 'react';
import { DataTable } from './data-table';
import type { GscData } from '../gsc-action'; // Import necessary type

type RawGscDataTableProps = {
  data: GscData[];
};

export function RawGscDataTable({ data }: RawGscDataTableProps) {
  const columns = [
    { key: 'site_id', label: '網站' }, { key: 'keyword', label: '關鍵字' },
    { key: 'mean_position', label: '平均排名' }, { key: 'min_position', label: '最低排名' }, { key: 'max_position', label: '最高排名' },
    { key: 'total_clicks', label: '點擊' }, { key: 'total_impressions', label: '展示' },
    { key: 'overall_ctr', label: 'CTR (%)' }, { key: 'associated_pages', label: '關聯頁面' },
  ];

  return (
    <DataTable
      title="原始 GSC 數據 (依最高排名排序)"
      columns={columns}
      data={data}
      headerClassName="bg-gray-100"
      renderRow={(item, index) => (
        <tr key={index} className="hover:bg-gray-50 text-sm border-b border-gray-200">
          <td className="px-4 py-1.5 font-mono text-gray-700">{item.site_id}</td>
          <td className="px-4 py-1.5 font-mono text-gray-700">{item.keyword}</td>
          <td className="px-4 py-1.5 text-right">
            <span className={`px-1.5 py-0.5 rounded font-mono text-xs ${ // Use text-xs for consistency
              item.mean_position <= 3 ? "bg-green-100 text-green-800" : 
              item.mean_position <= 10 ? "bg-blue-100 text-blue-800" : 
              item.mean_position <= 20 ? "bg-yellow-100 text-yellow-800" : 
              "bg-red-100 text-red-800"
            }`}>
              {item.mean_position.toFixed(1)}
            </span>
          </td>
          <td className="px-4 py-1.5 text-right font-mono text-gray-700">{item.min_position.toFixed(1)}</td>
          <td className="px-4 py-1.5 text-right font-mono text-gray-700">{item.max_position.toFixed(1)}</td>
          <td className="px-4 py-1.5 text-right font-mono text-gray-700">{item.total_clicks.toLocaleString()}</td>
          <td className="px-4 py-1.5 text-right font-mono text-gray-700">{item.total_impressions.toLocaleString()}</td>
          <td className="px-4 py-1.5 text-right font-mono text-gray-700">{(item.overall_ctr * 100).toFixed(2)}%</td>{/* Assuming overall_ctr is 0-1 */}
          <td className="px-4 py-1.5 text-xs max-w-[250px]">
            {Array.isArray(item.associated_pages) && item.associated_pages.length > 0 ? (
              <ul className="list-disc pl-4 space-y-0.5 font-mono">
                {item.associated_pages.slice(0, 3).map((url, i) => {
                  let displayText;
                  try {
                    const pathname = decodeURIComponent(new URL(url).pathname);
                    displayText = pathname.split('/').pop() || pathname;
                    if (displayText.length > 30) { // Truncate display text
                        displayText = displayText.substring(0, 27) + '...';
                    }
                  } catch {
                    displayText = url.split('/').pop() || url;
                    if (displayText.length > 30) {
                        displayText = displayText.substring(0, 27) + '...';
                    }
                  }
                  
                  return (
                    <li key={i} className="truncate" title={url}>
                      <a 
                        href={url} 
                        target="_blank"
                        rel="noopener noreferrer" 
                        className="hover:underline text-blue-600"
                      >
                        {displayText}
                      </a>
                    </li>
                  );
                })}
                {item.associated_pages.length > 3 && (
                  <li className="text-gray-500 text-xs">
                    +{item.associated_pages.length - 3} 個更多頁面
                  </li>
                )}
              </ul>
            ) : '無關聯頁面'}
          </td>
        </tr>
      )}
    />
  );
} 