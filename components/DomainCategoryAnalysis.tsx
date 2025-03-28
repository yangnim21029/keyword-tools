import React from 'react';
import { extractBaseDomain, getDomainCategory, competitionStandards } from './domainCategoryUtils';

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
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                <h3 className="text-xl font-bold">網域分類與競爭難度分析</h3>
                
                {/* 自家媒體標籤 */}
                {analysis.ownMediaCount > 0 && (
                    <div className="bg-purple-100 border-l-4 border-purple-500 p-2 rounded">
                        <div className="font-bold text-purple-800 flex items-center">
                            <span className="mr-2">自家媒體</span>
                            <span className="bg-purple-800 text-white rounded-full px-2 py-0.5 text-xs">
                                {analysis.ownMediaCount} 個網站
                            </span>
                        </div>
                        <div className="mt-1 text-sm">
                            {ownMediaDetails.map((item, index) => (
                                <div key={index} className="flex items-center text-purple-600">
                                    <span className="font-medium">#{item.position}</span>
                                    <span className="ml-2 truncate">{item.domain}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            {/* 競爭難度概覽 */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-lg font-medium mb-3">競爭難度評估</h4>
                    <div className="flex items-center mb-4">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${analysis.competitionClass}`}>
                            {analysis.competitionLevel}
                        </div>
                        <span className="ml-2 text-gray-600">
                            ({analysis.availablePositions}/10 個可競爭位置)
                        </span>
                    </div>
                    
                    <div className="space-y-2">
                        <p className="text-sm text-gray-700">競爭難度標準:</p>
                        <ul className="space-y-1 text-sm">
                            {Object.entries(competitionStandards).map(([key, { label, className }]) => (
                                <li key={key} className="flex items-center">
                                    <span className={`inline-block w-16 px-2 py-0.5 rounded text-xs mr-2 ${className}`}>
                                        {key}
                                    </span>
                                    <span>{label}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-lg font-medium mb-3">分類分布</h4>
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
                            <div key={category} className="flex justify-between items-center">
                                <span className={`text-gray-700 ${category === '自家媒體' ? 'font-bold text-purple-800' : ''}`}>
                                    {category}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                    category === '自家媒體' 
                                        ? 'bg-purple-100 text-purple-800 font-bold' 
                                        : category === 'Unknown' 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-blue-100 text-blue-800'
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
                <div className="mb-6 mt-4">
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <h4 className="font-medium text-gray-700 mb-2">搜索結果排名分布</h4>
                        <div className="grid grid-cols-10 gap-1">
                            {Array.from({length: 10}, (_, i) => i + 1).map(position => {
                                const result = analysis.categorizedDomains.find(r => r.position === position);
                                const isOwnMedia = result?.category === '自家媒體';
                                const isUnknown = result?.category === 'Unknown';
                                
                                return (
                                    <div 
                                        key={position} 
                                        className={`p-2 text-center rounded ${
                                            isOwnMedia 
                                                ? 'bg-purple-500 text-white font-bold' 
                                                : isUnknown 
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-gray-300'
                                        }`}
                                    >
                                        {position}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-2 flex gap-4 text-xs">
                            <div className="flex items-center">
                                <div className="w-3 h-3 bg-purple-500 rounded mr-1"></div>
                                <span>自家媒體</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
                                <span>可競爭位置</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-3 h-3 bg-gray-300 rounded mr-1"></div>
                                <span>其他網站</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DomainCategoryAnalysis; 