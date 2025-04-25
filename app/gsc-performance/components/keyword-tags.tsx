import React from 'react';

// Reusable KeywordTags Component
export function KeywordTags({ keywords }: { keywords: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 overflow-hidden sm:max-h-none sm:overflow-visible">
      {keywords.map((keyword, i) => (
        <span key={i} className="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-700 font-mono border border-gray-200">
          {keyword}
        </span>
      ))}
    </div>
  )
} 