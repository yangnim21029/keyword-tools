# Keyword Killer Next

Updated: 2024-05-06

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 核心數據模型

項目中有兩個主要的數據模型，分別用於不同的分析目的：

### KeywordResearch（關鍵詞研究）

KeywordResearch文檔主要用於關鍵詞分析和用戶意圖研究：

- **功能**：分析關鍵詞的搜索量、競爭程度和用戶意圖
- **數據結構**：
  ```typescript
  interface KeywordResearchDoc {
    id: string;
    query: string;  // 主關鍵詞
    keywords?: Keyword[];  // 關鍵詞列表及其搜索量數據
    clusters?: Record<string, string[]>;  // 語義分群結果
    personas?: Record<string, string>;  // 用戶畫像映射
    location?: string;  // 地區代碼，如 'TW'
    language?: string;  // 語言代碼，如 'zh-TW'
    createdAt: Date;  // 創建時間
    updatedAt: Date;  // 更新時間
  }
  ```
- **用途**：
  - SEO策略規劃
  - 內容創作方向指導
  - 了解目標受眾搜索行為和意圖
  - 發現相關關鍵詞和潛在內容主題

### SerpAnalysis（搜索引擎結果分析）

SerpAnalysis文檔專注於分析搜索引擎結果頁面的數據：

- **功能**：分析特定查詢在Google等搜索引擎中的結果頁面
- **數據結構**：
  ```typescript
  // SERP分析核心部分
  interface SerpDoc {
    id: string;  // 分析ID
    type: string;  // 類型標識為 "serp"
    query?: string;  // 主查詢關鍵詞
    serpResults?: title, metadescription, url, position, type(organic / ads), device(mobile/ desktop)
    domains: Record<string, number>;  // 域名分布統計
  }
  ```
- **分析內容**：
  - **域名分布**：統計排名頁面的域名分布情況，發現主導該關鍵詞的網站
  - **標題長度分析**：計算排名頁面的平均標題長度，了解最佳標題結構
  - **描述長度分析**：計算排名頁面的平均描述長度，了解最佳描述結構
  - **頁面類型分布**：分析結果頁面中的不同結果類型（標準結果、特色摘要、問答框等）
  - **HTML內容分析**：對排名頁面的HTML內容進行分析，了解內容結構特徵
- **用途**：
  - 競爭對手分析
  - 了解搜索引擎如何解釋特定查詢
  - 發現內容優化機會
  - 找出排名靠前的內容特徵和模式

### 數據模型關係

這兩種數據模型相輔相成，共同為SEO和內容策略提供完整視角：

- **KeywordResearch**：側重"什麼"—發現有價值的關鍵詞、用戶意圖和主題分群
- **Serp**：側重"如何"這些關鍵詞在搜索引擎中的具體表現和排名

當用戶通過KeywordResearch找到有價值的關鍵詞後，可以通過SerpAnalysis深入了解如何針對這些關鍵詞優化內容以獲得更好的排名。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
