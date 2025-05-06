import React from "react";
import Image from "next/image";
import { DataTable } from "./data-table";
import { KeywordTags } from "./keyword-tags";
import type { KeywordPerformance, SiteKeywordData } from "../gsc-action"; // Import necessary types

type SiteKeywordTableProps = {
  data: SiteKeywordData[];
  faviconUrlCache: Map<string, string>;
  totalImpressionsInTable: number;
};

export function SiteKeywordTable({
  data,
  faviconUrlCache,
  totalImpressionsInTable,
}: SiteKeywordTableProps) {
  const columns = [
    { key: "rank", label: "排名" },
    { key: "siteId", label: "網站" },
    { key: "totalImpressions", label: "總展示" },
    { key: "impressionShare", label: "展示佔比 (%)" },
    { key: "avgCtr", label: "平均 CTR (%)" },
    { key: "topKeywords", label: "主要關鍵字 (依展示排序)" },
  ];

  return (
    <DataTable
      title="主要流量網站與關鍵字"
      columns={columns}
      data={data}
      headerClassName="bg-gray-100"
      renderRow={(siteInfo, index) => {
        const faviconUrl = siteInfo.siteUrl
          ? faviconUrlCache.get(siteInfo.siteUrl)
          : null;
        const percentage =
          totalImpressionsInTable > 0
            ? (siteInfo.totalSiteImpressions / totalImpressionsInTable) * 100
            : 0;
        return (
          <tr
            key={index}
            className="hover:bg-gray-50 text-sm border-b border-gray-200"
          >
            <td className="px-4 py-1.5 text-right font-mono text-gray-700">
              {index + 1}
            </td>
            <td className="px-4 py-1.5">
              <div className="flex items-center gap-2">
                {faviconUrl && (
                  <Image
                    src={faviconUrl}
                    alt=""
                    width={16}
                    height={16}
                    className="w-4 h-4 flex-shrink-0"
                    loading="lazy"
                  />
                )}
                <span className="text-gray-700 font-mono">
                  {siteInfo.siteId}
                </span>
              </div>
            </td>
            <td className="px-4 py-1.5 text-right font-mono text-gray-700">
              {siteInfo.totalSiteImpressions.toLocaleString()}
            </td>
            <td className="px-4 py-1.5 text-right font-mono text-gray-700">
              {percentage.toFixed(1)}%
            </td>
            <td className="px-4 py-1.5 text-right font-mono text-gray-700">
              {siteInfo.avgCtr.toFixed(2)}%
            </td>
            <td className="px-4 py-1.5 min-w-[250px]">
              <KeywordTags
                keywords={siteInfo.keywords
                  .slice(0, 15)
                  .map((kw: KeywordPerformance) => kw.keyword)}
              />
            </td>
          </tr>
        );
      }}
    />
  );
}
