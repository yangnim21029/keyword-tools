// 資訊網站按主題分類 (簡化版)
const informationWebsites = {
    "自家媒體": [
        "businessfocus.io", "girlstyle.com", "pretty.presslogic.com",
        "holidaysmart.io", "mamidaily.com", "poplady-mag.com",
        "thekdaily.com", "topbeautyhk.com", "urbanlifehk.com", "thepetcity.co"
    ],
    "新聞媒體": [
        // 國際新聞媒體
        "cnn", "bbc", "reuters", "apnews", "nytimes",
        "theguardian", "bloomberg", "ft", "wsj", "aljazeera",
        "huffpost", "cnbc", "foxnews", "abcnews", "nbcnews",
        "usatoday", "time", "economist", "japantimes", "dw",
        "france24", "euronews", "independent", "thehill", "cbsnews",
        "politico", "newsweek", "theatlantic", "dailymail", "npr",
        "spiegel", "lemonde", "asahi", "kommersant", "globaltimes",
        "kyodonews", "straitstimes", "afp", "xinhua", "tass",
        // 台灣媒體
        "udn", "ltn", "chinatimes", "ettoday", "storm",
        "cna", "setn", "tvbs", "pts", "yahoo",
        "appledaily", "ctitv", "mirror", "newtalk", "cts",
        "ttv", "ftv", "bcc", "rti", "cti",
        "ebc", "edh", "nextmedia", "sina", "nownews",
        "bltv", "taiwannews", "focustaiwan", "taiwantoday", "formosa",
        // 香港媒體
        "scmp", "hk01", "appledaily", "rthk", "mingpao",
        "orientaldaily", "thestandnews", "hket", "am730", "singtao",
        "hkej", "skypost", "headline", "bastillepost", "inmediahk",
        "TVB", "nowTV", "cable", "phoenix", "wenweipo",
        "takungpao", "etnet", "aastocks", "hkcdn", "hkcna",
        // 中國媒體
        "sohu", "163", "qq", "people", "chinadaily", 
        "thepaper", "ifeng", "bjnews", "youth", "ce", 
        "huanqiu", "cnr", "caixin", "cctv", "finance.sina", 
        "eastmoney", "guancha", "jiemian", "yicai", "21jingji", 
        "nbd", "stcn", "36kr",
        // 其他亞洲媒體
        "channelnewsasia", "todayonline", "zaobao", "mothership",
        "theindependent", "businesstimes", "beritaharian", "8world",
        "asiaone", "vulcanpost", "thestar", "malaymail", "newsasia",
        "malaysiakini", "sinchew", "bharian", "nst",
        "themalaysianinsight", "theedgemarkets", "astroawani", "hmetro",
        "freemalaysiatoday", "themalaysianreserve", "themalaymailonline", "bernama",
        "chosun", "joins", "hankyung", "donga", "yna",
        "hani", "kbs", "sbs", "naver", "daum",
        "etnews", "mk", "mt", "khan", "kmib",
        "mbc", "ytn", "newsis", "ohmynews", "yonhap",
        "nhk", "yomiuri", "nikkei", "mainichi", "sankei", 
        "tokyo", "jiji", "chunichi", "kyodo", "toyokeizai"
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
export const extractBaseDomain = (url: string): string => {
    // 移除協議
    let domain = url;
    if (domain.includes('://')) {
        domain = domain.split('://')[1];
    }
    
    // 移除路徑和查詢參數
    if (domain.includes('/')) {
        domain = domain.split('/')[0];
    }
    
    // 移除'www.'前綴
    if (domain.startsWith('www.')) {
        domain = domain.substring(4);
    }
    
    return domain;
};

// 獲取域名的分類
export const getDomainCategory = (domain: string): string => {
    // 先提取基本域名
    const baseDomain = extractBaseDomain(domain).toLowerCase();
    
    // 先檢查是否為自家媒體
    const ownMediaDomains = informationWebsites["自家媒體"];
    for (const d of ownMediaDomains) {
        // 更精確地匹配自家媒體域名
        if (baseDomain === d || baseDomain.endsWith('.' + d) || baseDomain.includes(d)) {
            return "自家媒體";
        }
    }
    
    // 循環檢查每個分類
    for (const [category, domains] of Object.entries(informationWebsites)) {
        // 跳過已經檢查過的自家媒體
        if (category === "自家媒體") continue;
        
        // 檢查域名是否包含在任何分類的域名列表中
        for (const d of domains) {
            if (baseDomain.includes(d)) {
                return category;
            }
        }
    }
    
    return 'Unknown';
};

// 競爭難度標準
export const competitionStandards = {
    '<=3': { label: '難以操作 (Difficult)', className: 'bg-red-100 text-red-800' },
    '<=5': { label: '不一定 (Uncertain)', className: 'bg-yellow-100 text-yellow-800' },
    '<=6': { label: '可以操作 (Possible)', className: 'bg-blue-100 text-blue-800' },
    '>6': { label: '容易操作 (Easy)', className: 'bg-green-100 text-green-800' }
}; 