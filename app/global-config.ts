import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { LanguageModel } from 'ai';


/**
 * 地區映射常量
 * 使用索引簽名來允許字符串索引
 */
export const REGIONS: { [key: string]: string } = {
  香港: 'HK',
  台灣: 'TW',
  馬來西亞: 'MY',
  新加坡: 'SG',
  美國: 'US',
  韓國: 'KR'
};

/**
 * 語言映射常量
 */
export const LANGUAGES = {
  'zh-TW': '繁體中文',
  'zh-CN': '簡體中文',
  en: '英文',
  ms: '馬來文',
  ko: '韓文'
};

/**
 * 常用符號數組
 */
export const SYMBOLS = ['?', '@'];

/**
 * 英文字母數組
 */
export const ALPHABET = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z'
];

// --- Keyword Volume Thresholds --- //

export const HIGH_VOLUME_THRESHOLD = 400; // >= 400 is High
export const MEDIUM_VOLUME_THRESHOLD = 100; // 100-399 is Medium
// Low is implicitly < 100

// --- SERP Analysis Configuration --- //

/** Number of organic results to include in analysis prompts */
export const SERP_ANALYSIS_ORGANIC_RESULTS_LIMIT = 15;

// AI models for SERP analysis
export const AI_MODELS: { [key: string]: LanguageModel } = {
  ADVANCED: google('gemini-2.5-flash-preview-04-17'),
  /** Standard model for primary analysis steps */
  // BASE: google('gemini-2.5-flash-preview-04-17'),
  BASE: google('gemini-2.0-flash-lite'),
  /** Faster model for simpler conversion/recommendation steps */
  // FAST: google('gemini-2.5-flash-preview-04-17')
  FAST: google('gemini-2.0-flash-lite')
};

/** Default Firebase Function Region */
export const DEFAULT_FUNCTION_REGION = 'us-central1';

// --- Media Site Data --- //

// Website data in JSON format
export const MEDIASITE_DATA = [
  {
    url: 'https://businessfocus.io/',
    title: 'BusinessFocus | 聚焦商業投資世界',
    description:
      '一本發展迅速的線上商業和金融雜誌，為管理人員、科技愛好者和企業家提供嶄新的商業、投資、科技資訊和創業靈感',
    language: 'zh-TW',
    region: 'hk',
    name: 'BF'
  },
  {
    url: 'https://girlstyle.com/my/',
    title: 'GirlStyle 马来西亚女生日常 | 大马女孩专属的最Young情报站',
    description:
      '為女生集合全球各地的流行趋势，與妳分享女生們的生活、美容、时尚、恋爱日常等，用優質的内容走入你的心，讓你成為引领潮流的时髦Girl~',
    language: 'zh-CN',
    region: 'my',
    name: 'GSMY'
  },
  {
    url: 'https://girlstyle.com/tw/',
    title: '台灣女生日常 | 分享女孩間的生活樂趣',
    description:
      '女孩們最愛的美妝保養、時尚穿搭、娛樂名人、生活資訊，所有人氣熱話都盡在 GirlStyle 台灣女生日常',
    language: 'zh-TW',
    region: 'tw',
    name: 'GSTW'
  },
  {
    url: 'https://girlstyle.com/sg/',
    title: 'GirlStyle Singapore | No.1 SG Female Lifestyle Magazine',
    description:
      'Being the most engaging female online magazine in Singapore, we share the BEST deals in town, latest beauty trend, new product launches, travel tips, fitness tips, food & all other hot topics!',
    language: 'en',
    region: 'sg',
    name: 'GSSG'
  },
  {
    url: 'https://pretty.presslogic.com/',
    title: 'GirlStyle 女生日常 | 最受女性歡迎的網上雜誌',
    description:
      '分享美妝護膚、時尚穿搭、髮型美甲、網購等最新潮流情報、貼士與教學。探討各種網絡熱話、娛樂新聞、電影劇集，星座運程、愛情疑難。女生們愛看的資訊盡在GirlStyle 女生日常。',
    language: 'zh-TW',
    region: 'hk',
    name: 'GSHK'
  },
  {
    url: 'https://holidaysmart.io/',
    title: 'HolidaySmart 假期日常 | 香港最強食買玩旅遊資訊精明消費雜誌',
    description:
      '「HolidaySmart 假期日常」為讀者蒐羅高質素的本地及旅遊美食、必買、好去處資訊之外，亦會分享每日優惠情報、報告各類限時折扣優惠等，令大家一齊成為至 Smart 精明消費者。',
    language: 'zh-TW',
    region: 'hk',
    name: 'HS'
  },
  {
    url: 'https://holidaysmart.io/hk/',
    title: 'HolidaySmart 假期日常 | 香港最強食買玩旅遊資訊精明消費雜誌',
    description:
      '「HolidaySmart 假期日常」為讀者蒐羅高質素的本地及旅遊美食、必買、好去處資訊之外，亦會分享每日優惠情報、報告各類限時折扣優惠等，令大家一齊成為至 Smart 精明消費者。',
    language: 'zh-TW',
    region: 'hk',
    name: 'HSHK'
  },
  {
    url: 'https://holidaysmart.io/tw/',
    title: 'HolidaySmart 台灣假期日常 | 台灣最強食買玩旅遊資訊精明消費雜誌',
    description:
      '所有台灣消費者要知道的「去哪玩」、「搜好價」資訊！台灣本地及旅遊美食、生活購物、週末活動、優惠折扣等資料，盡在HolidaySmart 台灣假期日常。',
    language: 'zh-TW',
    region: 'tw',
    name: 'HSTW'
  },
  {
    url: 'https://mamidaily.com/',
    title: 'MamiDaily 親子日常 | 媽媽專屬的育兒心得交流平台',
    description:
      '一個專門為母親或準媽媽分享和獲得有關懷孕、育兒、升學和嬰兒服裝等資訊的平台。',
    language: 'zh-TW',
    region: 'hk',
    name: 'MD'
  },
  {
    url: 'https://poplady-mag.com/',
    title: 'PopLady | 時尚資訊生活品味平台',
    description:
      'PopLady 是一本以女性為主打的線上雜誌，搜羅世界各地最新最多最潮品牌、服裝穿搭、美容彩妝、時尚生活資訊，讓妳時刻輕易掌握潮流。',
    language: 'zh-TW',
    region: 'tw',
    name: 'PL'
  },
  {
    url: 'https://thekdaily.com/',
    title: 'Kdaily 韓粉日常 | 最強韓星、韓劇資訊及韓流娛樂討論網上雜誌',
    description:
      '韓星、韓劇、KPOP、綜藝、美食、旅遊等韓國娛樂資訊一把抓！持續追蹤韓流熱門話題，帶你看看最近韓妞都在夯什麼',
    language: 'zh-TW',
    region: 'tw',
    name: 'KD'
  },
  {
    url: 'https://topbeautyhk.com/',
    title: 'TopBeauty | 學習成為更美好更自信的自己',
    description:
      '將一切美妝護膚、健康修身、時尚購物、生活藝術、愛情及職場發展等相關資訊帶給所有愛自己和重視身心健康的女生。',
    language: 'zh-TW',
    region: 'hk',
    name: 'TB'
  },
  {
    url: 'https://urbanlifehk.com/',
    title:
      'UrbanLife Health 健康新態度 | 新一代都市人都關心的 · 健康生活新態度',
    description:
      '提供最新最深入的醫療健康資訊，搜羅專科醫生專業意見，帶大家認識癌症、深入了解皮膚濕疹、鼻敏感、胃痛、心口痛等常見病。介紹食物營養、湯水食譜，盡在 UrbanLife Health 健康新態度。',
    language: 'zh-TW',
    region: 'hk',
    name: 'UL'
  },
  {
    url: 'https://thepetcity.co',
    title: 'PetCity 毛孩日常 | 飼養寵物、寵物用品、萌寵趣聞',
    description:
      '專屬毛孩愛好者的資訊平台，不論你是貓奴、狗奴，還是其他動物控，一起發掘最新的萌寵趣聞、有趣的寵物飼養知識、訓練動物、寵物用品推薦、豐富多樣的寵物可愛影片。',
    language: 'zh-TW',
    region: 'tw',
    name: 'PC'
  }
];

// --- Global Navigation Configuration ---

// Define the types based on app/global-navigation.tsx structure
export type IconName =
  | 'search'
  | 'help'
  | 'pen'
  | 'bar-chart'
  | 'list'
  | 'settings'
  | 'box';

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  isPrimary: boolean;
};

export type SettingsItem = {
  label: string;
  icon: IconName;
};

// Define the main navigation items
export const NAV_ITEMS: NavItem[] = [
  // Primary Items
  {
    href: '/keyword-volume',
    label: '關鍵字工具',
    icon: 'search',
    isPrimary: true
  },
  { href: '/writing', label: 'Writing', icon: 'pen', isPrimary: true },
  { href: '/on-page-result', label: 'On-Page 分析', icon: 'bar-chart', isPrimary: true },
  {
    href: 'https://gsc-weekly-analyzer-241331030537.asia-east2.run.app', 
    label: 'GSC Weekly API',
    icon: 'bar-chart',
    isPrimary: true
  },
  { href: '/serp-result', label: 'SERP 分析', icon: 'bar-chart', isPrimary: true },

  {
    href: '/paragraph-rephrase',
    label: 'Paragraph Rephrase',
    icon: 'pen',
    isPrimary: true
  },
  { href: '/help', label: '說明', icon: 'help', isPrimary: true },
  // Secondary Items (Less clicked - will be tagged)
  {
    href: '/demo-product-function',
    label: 'Demo 功能',
    icon: 'bar-chart',
    isPrimary: false
  },
  { href: '/api', label: 'API Docs', icon: 'bar-chart', isPrimary: false },
  { href: '/dev', label: '各站成效', icon: 'bar-chart', isPrimary: false }
];

// Define the settings navigation item
export const SETTINGS_NAV_ITEM: SettingsItem = {
  label: 'Settings',
  icon: 'settings'
};
