import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function HelpPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">用這工具做關鍵字規劃？看這篇就懂 (FAQ)</h1>
      <p className="text-muted-foreground mb-8">
        剛開始用<Link href="/keyword-mapping" className="underline text-primary hover:opacity-80">這個工具</Link>做關鍵字規劃 (Keyword Mapping) 嗎？這裡解答您可能會想知道的幾個問題。
      </p>

      <Accordion type="single" collapsible className="w-full space-y-4">

        {/* Item 1 */}
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-lg font-semibold">
            工具怎麼找到關鍵字？一次看懂來源和整理方法
          </AccordionTrigger>
          <AccordionContent className="text-base leading-relaxed px-4 pt-2">
            <p>
              為了給您更多關鍵字點子，工具會從好幾個地方找資料，然後整理一下：
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li><strong>Google 自動建議：</strong> 就像您在 Google 搜尋時看到的那些自動建議 (包含加字母、加符號的變化)。</li>
              <li><strong>AI 提供建議：</strong> 利用 AI 模型，根據您的查詢詞、地區、語言，提供更多相關的字詞。</li>
              <li><strong>空格變化 (若適用)：</strong> 對中文等語言，自動在字詞中加入空格，找出大家不同的搜尋方式 (例如 "關鍵字 工具")。</li>
              <li><strong>網址分析 (若輸入 URL)：</strong> 從網址裡找出可能的關鍵字，再用這些字去問 Google 建議。</li>
            </ul>
            <p className="mt-2 text-sm">
              <strong>整理方法：</strong> 工具會把所有找到的字詞放在一起，去掉重複的，可能還會過濾掉一些不需要的 (像簡體字)，最後變成您看到的建議清單。
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Item 2 */}
        <AccordionItem value="item-2">
          <AccordionTrigger className="text-lg font-semibold">
            看懂搜尋量：了解數字來源和「0」代表什麼
          </AccordionTrigger>
          <AccordionContent className="text-base leading-relaxed px-4 pt-2">
            <p>
              搜尋量、競爭度這些數字，主要是從 **Google Ads API (關鍵字規劃工具)** 來的，這是大家常用的參考數字。
            </p>
            <p className="mt-2 text-muted-foreground">
              <span className="font-semibold text-primary">重點是工具怎麼處理：</span>
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li><strong>不是全部都查：</strong> 為了省錢和加快速度，工具<span className="underline">不會</span>幫您「所有」的建議字詞都去查搜尋量。它會<span className="underline">挑選最多 60 個</span>字優先送去 Google 查。</li>
              {/* Ensure > is escaped */}
              <li><strong>挑選順序：</strong> 挑選的順序大概是：空格變體 &gt; AI 建議 &gt; Google 建議 &gt; 其他。</li>
              <li><strong>為什麼搜尋量顯示 0？</strong>
                  <ol className="list-decimal list-inside ml-4 text-xs">
                     <li>這個字可能真的沒什麼人搜。</li>
                     <li>這個字工具<span className="font-semibold">沒有把它送去查</span> (就算它可能真的有人搜)。</li>
                  </ol>
              </li>
            </ul>
            <p className="mt-2 text-sm">
              <strong>怎麼用這個數字：</strong> 您可以用這個 (估計的) 搜尋量，大概了解哪個字比較熱門，幫助您決定先做哪些內容。
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Item 3 */}
        <AccordionItem value="item-3">
          <AccordionTrigger className="text-lg font-semibold">
            AI 怎麼幫關鍵字分組？用分群結果加速規劃
          </AccordionTrigger>
          <AccordionContent className="text-base leading-relaxed px-4 pt-2">
            <p>
              這個功能 (要手動點一下) 會用 **AI 分析字詞意思**，自動把意思相近的關鍵字放在一起。
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li><strong>怎麼做的：</strong> AI 會分析字詞的意義，把意思差不多、主題相關的字詞分到同一組。例如 "白色帆布鞋 清潔" 和 "白布鞋 保養" 可能會放在同一組。</li>
              <li><strong>前提：</strong> 至少要有 5 個不同的關鍵字才能分得比較好。</li>
            </ul>
            <p className="mt-2 text-sm">
              <strong>怎麼用分組結果：</strong> 分組結果可以幫助您：
                <ol className="list-decimal list-inside ml-4 text-xs">
                    <li><strong>找出主要內容主題：</strong> 很快了解這些關鍵字大概在講哪些主題。</li>
                    <li><strong>決定哪些字可以放同個頁面：</strong> <span className="font-semibold">同一組裡的關鍵字，通常可以放在同一個網頁裡討論</span>。這樣就不用每個很像的字都做一個網頁，幫助您的網頁在某個主題上看起來更專業 (Topic Clusters)。</li>
                </ol>
            </p>
          </AccordionContent>
        </AccordionItem>

         {/* Item 4 */}
        <AccordionItem value="item-4">
          <AccordionTrigger className="text-lg font-semibold">
            工具結果怎麼用？一步步應用到實際規劃
          </AccordionTrigger>
          <AccordionContent className="text-base leading-relaxed px-4 pt-2">
            <p>
              工具給您的結果，是做規劃的基礎：
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li><strong>看看關鍵字清單：</strong> 查看工具提供的關鍵字、搜尋量 (想想看 0 可能代表什麼) 和競爭度。</li>
              <li><strong>參考分群結果 (若有)：</strong> 如果做了分群，把同一組的關鍵字看成一個內容主題。</li>
              <li><strong>挑出主要的和次要的關鍵字：</strong> 在每一組（或您自己想的主題）裡，選一個搜尋量比較高、最能代表這個主題的當作「主要關鍵字」，其他相關的當作「次要關鍵字」。</li>
              <li><strong>把關鍵字分配給網頁：</strong> 把選好的「主要」和「次要」關鍵字組合起來，分配給網站上最適合的現有網頁，或者規劃一個新的網頁來放這個主題。</li>
              <li><strong>把它記下來：</strong> 把您分配的結果 (哪個關鍵字 -&gt; 對應哪個網址) 記在您的規劃檔案裡 (例如 Excel 或 Google Sheet)。</li>
            </ul>
             <p className="mt-2 text-sm">
               這個規劃檔案就是您之後寫內容、改網頁、看成效的依據。
            </p>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
}
