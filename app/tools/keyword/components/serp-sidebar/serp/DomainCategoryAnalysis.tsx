import type { SerpResultItem } from '@/app/types/serp.types'; // Import the canonical type
import React from 'react';
// Remove the import for the deleted file
// import { competitionStandards, extractBaseDomain, getDomainCategory } from './domainCategoryUtils';

// --- Copied Definitions from domainCategoryUtils.ts ---

// 資訊網站按主題分類 (簡化版)
const informationWebsites = {
    "自家媒體": [
        "businessfocus.io", "girlstyle.com", "pretty.presslogic.com",
        "holidaysmart.io", "mamidaily.com", "poplady-mag.com",
        "thekdaily.com", "topbeautyhk.com", "urbanlifehk.com", "thepetcity.co"
    ],
    "新聞媒體": [
        "cnn", "bbc", "reuters", "apnews", "nytimes",
        "theguardian", "bloomberg", "ft", "wsj", "aljazeera",
        "huffpost", "cnbc", "foxnews", "abcnews", "nbcnews",
        "udn", "ltn", "chinatimes", "ettoday", "storm",
        "cna", "setn", "tvbs", "pts", "yahoo",
        "scmp", "hk01", "appledaily", "rthk", "mingpao",
        "orientaldaily", "thestandnews", "hket", "am730", "singtao",
        // Add more as needed
    ],
    "科技媒體": [
        "techcrunch", "wired", "theverge", "arstechnica", "cnet",
        "zdnet", "engadget", "gizmodo", "slashdot", "techmeme",
        "pconline", "itmedia", "ascii"
    ],
    "時尚美妝": [
        "allure", "cosmopolitan", "vogue", "elle", "harpersbazaar",
        "glamour", "stylenanda", "sephora", "stylekorean", "yesstyle",
        "beautybay", "jolse", "cosme", "watsons"
    ],
    "學術研究": [
        "scholar.google", "researchgate", "academia", "jstor", "sciencedirect",
        "nature", "science", "ieee", "pubmed", "arxiv", "wikipedia", "wiki"
    ],
    "電子商務": [
        "amazon", "shopee", "lazada", "qoo10", "taobao",
        "jd", "gmarket", "coupang", "11street", "hktvmall", "zalora", "momo"
    ],
    "社交平台": [
        "facebook", "instagram", "tiktok", "twitter", "linkedin", 
        "pinterest", "reddit", "tumblr", "quora", "weibo", "douyin",
        "youtube", "netflix", "kkbox", "viu"
    ]
};

// 從網址中提取基本域名
const extractBaseDomain = (url: string): string => {
    if (!url) return '';
    let domain = url;
    if (domain.includes('://')) {
        domain = domain.split('://')[1];
    }
    if (domain.includes('/')) {
        domain = domain.split('/')[0];
    }
    if (domain.startsWith('www.')) {
        domain = domain.substring(4);
    }
    return domain;
};

// 獲取域名的分類
const getDomainCategory = (domain: string): string => {
    if (!domain) return 'Unknown';
    const baseDomain = extractBaseDomain(domain).toLowerCase();
    
    const ownMediaDomains = informationWebsites["自家媒體"];
    for (const d of ownMediaDomains) {
        if (baseDomain === d || baseDomain.endsWith('.' + d)) { // More specific match for own media
            return "自家媒體";
        }
    }
    
    for (const [category, domains] of Object.entries(informationWebsites)) {
        if (category === "自家媒體") continue;
        for (const d of domains) {
            if (baseDomain.includes(d)) {
                return category;
            }
        }
    }
    
    return 'Unknown';
};

// 競爭難度標準
const competitionStandards = {
    '<=3': { label: '難以操作 (Difficult)', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-300 dark:border-red-700' },
    '<=5': { label: '不一定 (Uncertain)', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700' },
    '<=6': { label: '可以操作 (Possible)', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-300 dark:border-blue-700' },
    '>6': { label: '容易操作 (Easy)', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-300 dark:border-green-700' }
};

// --- End Copied Definitions ---

// Remove the local definition
/*
interface SerpResultItem {
    position: number; 
    title: string;
    url: string;
    displayUrl: string;
    domain?: string;
    description: string;
    siteLinks?: any[];
}
*/

interface DomainCategoryAnalysisProps {
    // Use the imported type
    results: SerpResultItem[]; 
    domains: Record<string, number>;
    topDomains: string[];
    competitionData?: Record<string, { level: string; category: string }>;
}

// Placeholder for competition data - Replace with actual data source
const defaultDomainCompetition: Record<string, { level: string; category: string }> = {
  "example.com": { level: "high", category: "Tech" },
  "test.org": { level: "medium", category: "News" },
  "another.net": { level: "low", category: "Education" },
};

// 分析搜尋結果競爭度
const analyzeSerpCompetition = (results: SerpResultItem[], competitionData: Record<string, { level: string; category: string }>): {
    categorizedDomains: Array<{position: number, domain: string, category: string}>;
    availablePositions: number;
    competitionLevel: string;
    competitionClass: string;
    ownMediaCount: number;
} => {
    // Filter results to ensure position is a positive number before slicing
    const validResults = results.filter(r => typeof r.position === 'number' && r.position > 0);
    
    // Sort by position to be sure, then take top 10
    validResults.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const topResults = validResults.slice(0, 10);
    
    // 分析每個結果
    const categorizedResults = topResults.map(result => {
        const position = result.position!; 
        
        // 確保域名是字符串類型
        let domainStr = "";
        
        // 檢查result.domain是否為字符串
        if (typeof result.domain === 'string') {
            domainStr = result.domain;
        } else if (result.url) {
            // 如果domain不是字符串，但有URL，則嘗試從URL提取
            domainStr = extractBaseDomain(result.url);
        }
        
        // 獲取域名分類
        const category = getDomainCategory(domainStr);
        
        return {
            position, 
            domain: domainStr,
            category
        };
    });
    
    // Calculate own media count based on categorized results
    const ownMediaCount = categorizedResults.filter(r => r.category === '自家媒體').length;
    
    // Calculate available positions (Unknown category) among the categorized top results
    const availablePositions = categorizedResults.filter(r => r.category === 'Unknown').length;
    
    // Determine competition level based on available positions among the categorized top results
    let competitionKey = '>6';
    
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

const DomainCategoryAnalysis: React.FC<DomainCategoryAnalysisProps> = ({ results, domains, topDomains, competitionData = defaultDomainCompetition }) => {
    // 分析競爭度
    const analysis = analyzeSerpCompetition(results, competitionData);
    
    // 獲取自家媒體詳細資訊
    const ownMediaDetails = analysis.categorizedDomains
        .filter(item => item.category === '自家媒體')
        .map(item => ({
            position: item.position,
            domain: item.domain
        }));
    
    return (
        <div>
            <h2 className="text-base font-semibold mb-2">網域分類與競爭難度分析</h2>
            
            {/* 自家媒體標籤 */}
            {analysis.ownMediaCount > 0 && (
                <div className="bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 p-2 rounded-md mb-3">
                    <div className="font-bold text-purple-900 dark:text-purple-300 flex items-center text-sm">
                        <span className="mr-2">自家媒體</span>
                        <span className="bg-purple-800 dark:bg-purple-700 text-white rounded-full px-2 py-0.5 text-xs">
                            {analysis.ownMediaCount} 個網站
                        </span>
                    </div>
                    <div className="mt-1 text-xs">
                        {ownMediaDetails.map((item, index) => (
                            <div key={index} className="flex items-center text-purple-700 dark:text-purple-400">
                                <span className="font-medium">#{item.position}</span>
                                <span className="ml-2 truncate">{item.domain}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* 競爭難度評估 */}
            <div className="p-3 rounded-md border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium mb-2 text-black dark:text-gray-200">競爭難度評估</h3>
                <div className="flex items-center mb-2">
                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${analysis.competitionClass}`}>
                        {analysis.competitionLevel}
                    </div>
                    <span className="ml-2 text-xs text-gray-700 dark:text-gray-400">
                        ({analysis.availablePositions}/10 個可競爭位置)
                    </span>
                </div>
                
                {/* 競爭難度標準 */}
                <div className="text-xs space-y-1 mt-2">
                    <p className="text-gray-700 dark:text-gray-400">競爭難度標準:</p>
                    <div className="grid grid-cols-2 gap-1">
                        {Object.entries(competitionStandards).map(([key, { label, className }]) => (
                            <div key={key} className="flex items-center">
                                <span className={`inline-block w-12 px-1 py-0.5 rounded text-xs mr-1 ${className}`}>
                                    {key}
                                </span>
                                <span className="text-gray-800 dark:text-gray-300 text-xs">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DomainCategoryAnalysis; 