import React from 'react';
import { competitionStandards, extractBaseDomain, getDomainCategory } from './domainCategoryUtils';

interface SerpResultItem {
    position: number;
    title: string;
    url: string;
    displayUrl: string;
    domain?: string;
    description: string;
    siteLinks?: any[];
}

interface DomainCategoryAnalysisProps {
    results: SerpResultItem[];
}

// 分析搜尋結果競爭度
const analyzeSerpCompetition = (results: SerpResultItem[]): {
    categorizedDomains: Array<{position: number, domain: string, category: string}>;
    availablePositions: number;
    competitionLevel: string;
    competitionClass: string;
    ownMediaCount: number;
} => {
    // 確保我們只分析前 10 個結果
    const topResults = results.slice(0, 10);
    
    // 分析每個結果
    const categorizedResults = topResults.map(result => {
        const domain = result.domain || extractBaseDomain(result.url);
        const category = getDomainCategory(domain);
        
        return {
            position: result.position,
            domain,
            category
        };
    });
    
    // 計算自家媒體數量
    const ownMediaCount = categorizedResults.filter(r => r.category === '自家媒體').length;
    
    // 計算可用位置（未被歸類的網站）
    const availablePositions = categorizedResults.filter(r => r.category === 'Unknown').length;
    
    // 確定競爭難度
    let competitionKey = '>6';
    let competitionLevel = '';
    
    if (availablePositions <= 3) {
        competitionKey = '<=3';
    } else if (availablePositions <= 5) {
        competitionKey = '<=5';
    } else if (availablePositions <= 6) {
        competitionKey = '<=6';
    }
    
    return {
        categorizedDomains: categorizedResults,
        availablePositions,
        ownMediaCount,
        competitionLevel: competitionStandards[competitionKey as keyof typeof competitionStandards].label,
        competitionClass: competitionStandards[competitionKey as keyof typeof competitionStandards].className
    };
};

const DomainCategoryAnalysis: React.FC<DomainCategoryAnalysisProps> = ({ results }) => {
    // 分析競爭度
    const analysis = analyzeSerpCompetition(results);
    
    // 獲取自家媒體詳細資訊
    const ownMediaDetails = analysis.categorizedDomains
        .filter(item => item.category === '自家媒體')
        .map(item => ({
            position: item.position,
            domain: item.domain
        }));
    
    return (
        <div className="border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden bg-white dark:bg-gray-900">
            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
                <div className="p-4 space-y-4">
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                        {/* 自家媒體標籤 */}
                        {analysis.ownMediaCount > 0 && (
                            <div className="bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 p-3 rounded">
                                <div className="font-bold text-purple-900 dark:text-purple-300 flex items-center">
                                    <span className="mr-2">自家媒體</span>
                                    <span className="bg-purple-800 dark:bg-purple-700 text-white rounded-full px-2 py-0.5 text-xs">
                                        {analysis.ownMediaCount} 個網站
                                    </span>
                                </div>
                                <div className="mt-1 text-sm">
                                    {ownMediaDetails.map((item, index) => (
                                        <div key={index} className="flex items-center text-purple-700 dark:text-purple-400">
                                            <span className="font-medium">#{item.position}</span>
                                            <span className="ml-2 truncate">{item.domain}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* 競爭難度概覽 */}
                    <div className="mb-4 space-y-4">
                        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 rounded-lg">
                            <h4 className="text-lg font-medium mb-3 text-black dark:text-gray-200">競爭難度評估</h4>
                            <div className="flex items-center mb-4">
                                <div className={`px-3 py-1 rounded-full text-sm font-medium ${analysis.competitionClass}`}>
                                    {analysis.competitionLevel}
                                </div>
                                <span className="ml-2 text-gray-700 dark:text-gray-400">
                                    ({analysis.availablePositions}/10 個可競爭位置)
                                </span>
                            </div>
                            
                            <div className="space-y-2">
                                <p className="text-sm text-gray-800 dark:text-gray-300">競爭難度標準:</p>
                                <ul className="space-y-1 text-sm">
                                    {Object.entries(competitionStandards).map(([key, { label, className }]) => (
                                        <li key={key} className="flex items-center">
                                            <span className={`inline-block w-16 px-2 py-0.5 rounded text-xs mr-2 ${className}`}>
                                                {key}
                                            </span>
                                            <span className="text-gray-800 dark:text-gray-300">{label}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 rounded-lg">
                            <h4 className="text-lg font-medium mb-3 text-black dark:text-gray-200">分類分布</h4>
                            <div className="space-y-2">
                                {Object.entries(results.reduce((acc, item) => {
                                    const category = getDomainCategory(extractBaseDomain(item.url));
                                    if (!acc[category]) acc[category] = 0;
                                    acc[category]++;
                                    return acc;
                                }, {} as Record<string, number>)).sort((a, b) => {
                                    // 自家媒體永遠排在最前面
                                    if (a[0] === '自家媒體') return -1;
                                    if (b[0] === '自家媒體') return 1;
                                    // 其他按數量排序
                                    return b[1] - a[1];
                                }).map(([category, count]) => (
                                    <div key={category} className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-700">
                                        <span className={`text-gray-800 dark:text-gray-300 ${category === '自家媒體' ? 'font-bold text-purple-900 dark:text-purple-300' : ''}`}>
                                            {category}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-md text-xs ${
                                            category === '自家媒體' 
                                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-300 font-bold border border-purple-300 dark:border-purple-700' 
                                                : category === 'Unknown' 
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300 border border-green-300 dark:border-green-700' 
                                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                                        }`}>
                                            {count} 個網站
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* 頂部自家媒體與競爭位置概況 */}
                    {analysis.ownMediaCount > 0 && (
                        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-3 rounded-lg">
                            <h4 className="font-medium text-gray-800 dark:text-gray-300 mb-2">搜索結果排名分布</h4>
                            <div className="grid grid-cols-10 gap-1">
                                {Array.from({length: 10}, (_, i) => i + 1).map(position => {
                                    const result = analysis.categorizedDomains.find(r => r.position === position);
                                    const isOwnMedia = result?.category === '自家媒體';
                                    const isUnknown = result?.category === 'Unknown';
                                    
                                    return (
                                        <div 
                                            key={position} 
                                            className={`p-2 text-center rounded border ${
                                                isOwnMedia 
                                                    ? 'bg-purple-500 dark:bg-purple-600 text-white font-bold border-purple-700 dark:border-purple-800' 
                                                    : isUnknown 
                                                        ? 'bg-green-500 dark:bg-green-600 text-white border-green-700 dark:border-green-800'
                                                        : 'bg-gray-300 dark:bg-gray-600 border-gray-400 dark:border-gray-700'
                                            }`}
                                        >
                                            {position}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-2 flex gap-4 text-xs text-gray-800 dark:text-gray-300">
                                <div className="flex items-center">
                                    <div className="w-3 h-3 bg-purple-500 dark:bg-purple-600 border border-purple-700 dark:border-purple-800 rounded mr-1"></div>
                                    <span>自家媒體</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-3 h-3 bg-green-500 dark:bg-green-600 border border-green-700 dark:border-green-800 rounded mr-1"></div>
                                    <span>可競爭位置</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 border border-gray-400 dark:border-gray-700 rounded mr-1"></div>
                                    <span>其他網站</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DomainCategoryAnalysis; 