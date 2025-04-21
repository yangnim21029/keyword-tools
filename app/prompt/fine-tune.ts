import { z } from "zod"

const themeFineTuneDataSchema = z.object({
    "name": z.string(),
    "tag": z.string(),
    "date": z.string(),
    "data_set_description": z.string(),
    "data": z.array(z.object({
        "Bad": z.string(),
        "Good": z.string(),
        "Reason": z.string(),
        "Guide": z.string(),
        "ErrorType": z.string(),
        "Process": z.string(),
        "Section": z.string(),
    }))
})

export type ThemeFineTuneData = z.infer<typeof themeFineTuneDataSchema>

const mediaSiteFineTuneDataSchema = z.object({
    "name": z.string(),
    "tag": z.string(),
    "date": z.string(),
    "data_set_description": z.string(),
    "data": z.array(z.object({
        "Guide": z.string(),
    }))
})

export type MediaSiteFineTuneData = z.infer<typeof mediaSiteFineTuneDataSchema>
const languageFineTuneDataSchema = z.object({
    "name": z.string(), 
    "tag": z.string(),
    "date": z.string(),
    "data_set_description": z.string(),
    "data": z.array(z.object({
        "bad": z.string(),
        "good": z.string(),
        "錯字": z.string(),
        "正確": z.string(),
    }))
})

export type LanguageFineTuneData = z.infer<typeof languageFineTuneDataSchema>


export const THEME_FINE_TUNE_DATA = [{
    "name": "recipe-fine-tune",
    "tag": "recipe",
    "date": "2025-04-18",
    "data_set_description": "這個資料集是針對食譜文章的優化，主要針對食譜文章的結構進行優化，包括食譜的結構、食譜的內容、食譜的格式等。",
    "data":[
      {
        "Bad": "延伸推薦：更多食譜推介",
        "Good": "食譜A+食譜B+食譜C",
        "Reason": "",
        "Guide": "",
        "ErrorType": "",
        "Process": "",
        "Section": "食譜",
        "From": "燉湯食譜"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "譬如「烹煮重點（在『製作步驟』已經有提及」、「保存方法（在『常見問題』中已經有提及」。另外，在「飲用建議與其他湯品比較」也與以上一些內容出現重覆，所以我也會把這一部分與上面重覆的內容結合）",
        "ErrorType": "",
        "Process": "",
        "Section": "食譜",
        "From": "南瓜栗子湯功效"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "這篇文章主要是針對「南瓜栗子湯」，並不太適合出現其他湯品的介紹。",
        "ErrorType": "",
        "Process": "",
        "Section": "食譜清單",
        "From": "南瓜栗子湯功效"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "在「製作步驟」中，更希望可以簡單易懂一些。（已進行概述）",
        "ErrorType": "",
        "Process": "",
        "Section": "食譜 步驟",
        "From": "南瓜栗子湯功效"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "讀者可能比較關心這道湯品的整體功效，並較少關注在於食品單獨的功效。",
        "Guide": "",
        "ErrorType": "",
        "Process": "",
        "Section": "功效",
        "From": "南瓜栗子湯功效"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "例如先以「南瓜栗子湯」為大題展開，並延伸至「南瓜栗子淮山湯」與「南瓜栗子排骨湯」的食譜進行，以此類推。",
        "ErrorType": "",
        "Process": "",
        "Section": "食譜清單",
        "From": "南瓜栗子湯功效"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "保存方法與時長可能會有爭議，可略過",
        "ErrorType": "",
        "Process": "",
        "Section": "注意事項",
        "From": "雞殼煲湯"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "「常見問題」與「烹飪建議」選擇不同題材寫，要有明顯區別",
        "ErrorType": "",
        "Process": "",
        "Section": "注意事項 / 常見問題",
        "From": "雞殼煲湯"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "避免加入 「初步的網路搜尋顯示」等字眼",
        "ErrorType": "語法要求",
        "Process": "修正",
        "Section": "",
        "From": "雞殼煲湯"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "食譜應避免過度使用文獻",
        "ErrorType": "格式要求",
        "Process": "刪除",
        "Section": "",
        "From": "肺炎湯水"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "「適合香港與台灣」、「港澳台」等字眼不應使用",
        "ErrorType": "語法要求",
        "Process": "修正",
        "Section": "",
        "From": "五指毛桃粉葛湯"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "避免字眼使用重複及過度解釋，應將類似字眼放於一起",
        "ErrorType": "語法要求",
        "Process": "修正",
        "Section": "",
        "From": "止咳湯水小朋友"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "至少包含食材準備的步驟",
        "ErrorType": "",
        "Process": "",
        "Section": "食譜 步驟",
        "From": "家常湯食譜"
      },
      {
        "Bad": "上一句用「馬鈴薯」，下一句用「薯仔」",
        "Good": "上一句用「馬鈴薯」，下一句用「馬鈴薯」",
        "Reason": "",
        "Guide": "對食材應統一用詞，僅少數段落可用特殊稱呼",
        "ErrorType": "",
        "Process": "",
        "Section": "Article",
        "From": "家常湯食譜"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "避免使用『香港註冊中醫師李偉寧』",
        "ErrorType": "",
        "Process": "",
        "Section": "引用來源",
        "From": "五指毛桃粉葛湯"
      },
      {
        "Bad": "淮山栗子雞湯做法 ... 淮山栗子雞湯的好處...",
        "Good": "淮山栗子雞湯的好處... 淮山栗子雞湯的做法...食譜與烹煮建議",
        "Reason": "",
        "Guide": "補品可以先介紹好處，再介紹食譜",
        "ErrorType": "",
        "Process": "",
        "Section": "食譜",
        "From": "淮山栗子雞湯"
      },
      {
        "Bad": "上面介紹了湯品好處，有提到了藥材對身體的功效，然後下面又單個介紹藥材的好處",
        "Good": "湯品好處包括藥材的好處...",
        "Reason": "",
        "Guide": "",
        "ErrorType": "",
        "Process": "",
        "Section": "",
        "From": "淮山栗子雞湯"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "食材的種植方式與來源是否道德生產和環境友好，只留跟主題特別相關的部分，需要增加吸引力",
        "ErrorType": "",
        "Process": "",
        "Section": "文化",
        "From": "合掌瓜淮山栗子湯"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "科普資料較需要增加吸引力",
        "ErrorType": "",
        "Process": "",
        "Section": "科普",
        "From": "合掌瓜淮山栗子湯"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "「多種變化版本」只是簡單介紹，如果加入詳細多種菜譜會讓文章更充足",
        "ErrorType": "",
        "Process": "",
        "Section": "食譜清單",
        "From": "豆腐魚湯食譜"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "「健康成分解析」與「特定健康功效」內容相似。（刪減）",
        "ErrorType": "",
        "Process": "",
        "Section": "功效",
        "From": "豆腐魚湯食譜"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "「提升免疫力的配方指南」與「健康功效」相似，而且這個部分資訊冗長。（刪減）\n",
        "ErrorType": "",
        "Process": "",
        "Section": "功效",
        "From": "豆腐魚湯食譜"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "以表格呈現，直接一目瞭然三種魚類的差異，增加易讀性",
        "ErrorType": "",
        "Process": "",
        "Section": "魚種比較",
        "From": "豆腐魚湯食譜"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "H2擬題命名有點模糊。例如 「特定健康功效」修改成「湯品健康功效」會更清晰。",
        "ErrorType": "SEO錯誤",
        "Process": "修正",
        "Section": "大綱",
        "From": "豆腐魚湯食譜"
      },
      {
        "Bad": "粟米紅蘿蔔雪耳湯的主要功效",
        "Good": "粟米紅蘿蔔雪耳湯功效",
        "Reason": "",
        "Guide": "功效不講主要",
        "ErrorType": "語法要求",
        "Process": "修正",
        "Section": "",
        "From": "粟米紅蘿蔔雪耳湯"
      },
      {
        "Bad": "舀起一勺入口，湯頭甘甜而不膩滯",
        "Good": "湯頭甘甜而不膩滯",
        "Reason": "",
        "Guide": "不寫人物行為動詞，非食材料理步驟，可略過",
        "ErrorType": "語法要求",
        "Process": "修正",
        "Section": "",
        "From": "粟米紅蘿蔔雪耳湯"
      },
      {
        "Bad": "餘韻中隱隱透出蟲草花特有的香氣",
        "Good": "隱隱透出蟲草花特有的香氣",
        "Reason": "",
        "Guide": "盡量減少高難度副詞",
        "ErrorType": "語法要求",
        "Process": "修正",
        "Section": "",
        "From": "粟米紅蘿蔔雪耳湯"
      },
      {
        "Bad": "馬蹄（荸薺）",
        "Good": "馬蹄",
        "Reason": "",
        "Guide": "句子間不要增加括號",
        "ErrorType": "錯誤格式",
        "Process": "修正",
        "Section": "Article",
        "From": "粟米紅蘿蔔雪耳湯"
      },
      {
        "Bad": "所謂金銀菜指的就是菜乾（曬乾的小白菜）與新鮮白菜的絕妙組合",
        "Good": "",
        "Reason": "",
        "Guide": "不要非食材的副詞當結尾",
        "ErrorType": "冗言",
        "Process": "刪除",
        "Section": "",
        "From": "粟米紅蘿蔔雪耳湯"
      },
      {
        "Bad": "清洗豬肺：將新鮮豬肺在水龍頭下沖洗乾净 g",
        "Good": "豬肺沖洗乾净",
        "Reason": "",
        "Guide": "製作步驟由食材主詞動詞副詞句子開頭",
        "ErrorType": "語法要求",
        "Process": "修正",
        "Section": "",
        "From": "粟米紅蘿蔔雪耳湯"
      },
      {
        "Bad": "食材浸洗：將菜乾放入清水中浸泡30分鐘至1小時",
        "Good": "菜乾浸泡30分鐘至1小時",
        "Reason": "",
        "Guide": "製作步驟由食材主詞動詞副詞句子開頭",
        "ErrorType": "語法要求",
        "Process": "修正",
        "Section": "",
        "From": "粟米紅蘿蔔雪耳湯"
      },
      {
        "Bad": "起一口乾淨的炒鍋",
        "Good": "起炒鍋",
        "Reason": "",
        "Guide": "去掉過長的形容詞",
        "ErrorType": "冗言",
        "Process": "刪除",
        "Section": "",
        "From": "金銀菜豬肺湯"
      },
      {
        "Bad": "這一步能有效去除豬肺的腥味與雜質，確保湯清無異味。",
        "Good": "刪除",
        "Reason": "",
        "Guide": "冗言｜步驟效果明顯，無需再次強調，刪除",
        "ErrorType": "冗言",
        "Process": "刪除",
        "Section": "",
        "From": "金銀菜豬肺湯"
      },
      {
        "Bad": "熬湯：取一大湯鍋，放入處理好的豬骨",
        "Good": "放入處理好的豬骨",
        "Reason": "",
        "Guide": "動詞開頭，不要冒號斷句",
        "ErrorType": "錯誤格式",
        "Process": "修正",
        "Section": "",
        "From": "金銀菜豬肺湯"
      },
      {
        "Bad": "（因有蜜棗甜味，可不放鹽或少放，依個人口味）",
        "Good": "",
        "Reason": "",
        "Guide": "無需容易混淆的括號句子",
        "ErrorType": "冗言",
        "Process": "刪除",
        "Section": "",
        "From": "金銀菜豬肺湯"
      },
      {
        "Bad": "煲好的湯品可將豬肺和白菜一同撈起裝碗，湯渣皆可食用，是一道老少咸宜的營養湯餸。",
        "Good": "",
        "Reason": "",
        "Guide": "段落結語不應放過多額外具體資訊，重要的額外資訊只需另開段落",
        "ErrorType": "冗言",
        "Process": "刪除",
        "Section": "",
        "From": "金銀菜豬肺湯"
      },
      {
        "Bad": "好的金銀菜豬肺湯湯色清澈帶微乳白，飄散著白菜與蜜棗的清甜香氣，撲鼻而來令人食指大動。舀起一碗，只見豬肺塊潔白軟嫩",
        "Good": "",
        "Reason": "",
        "Guide": "避免散文等冗長描述",
        "ErrorType": "風格不符",
        "Process": "刪除",
        "Section": "",
        "From": "金銀菜豬肺湯"
      },
      {
        "Bad": "將浸軟的杏仁連同600ml清水",
        "Good": "浸泡後連同600ml清水",
        "Reason": "",
        "Guide": "連接詞需更多使用副詞子句，而非重寫完整句",
        "ErrorType": "語法錯誤",
        "Process": "修正",
        "Section": "",
        "From": "杏汁豬肺湯功效"
      },
      {
        "Bad": "使杏仁充分吸水變軟",
        "Good": "使其吸水變軟",
        "Reason": "",
        "Guide": "上下句可用代名詞",
        "ErrorType": "語法錯誤",
        "Process": "修正",
        "Section": "",
        "From": "杏汁豬肺湯功效"
      },
      {
        "Bad": "將南、北杏仁分別洗淨後混合，加入清水浸泡約6小時",
        "Good": "將南、北杏仁洗淨後混合，再浸泡約6小時",
        "Reason": "",
        "Guide": "同個上下文，動詞主體要以食材為主，而非人",
        "ErrorType": "語法錯誤",
        "Process": "修正",
        "Section": "",
        "From": "杏汁豬肺湯功效"
      },
      {
        "Bad": "將南、北杏仁分別洗淨後混合",
        "Good": "將南、北杏仁洗淨後混合",
        "Reason": "",
        "Guide": "副詞要有額外補充特例，而非描述原有的狀態",
        "ErrorType": "語法錯誤",
        "Process": "修正",
        "Section": "",
        "From": "杏汁豬肺湯功效"
      },
      {
        "Bad": "新鮮豬肺拿回來先在水龍頭下反覆灌水",
        "Good": "新鮮豬肺先在水龍頭下反覆灌水",
        "Reason": "",
        "Guide": "同一句盡量用單一動詞，與食材有關的動詞，而非人物",
        "ErrorType": "語法錯誤",
        "Process": "修正",
        "Section": "",
        "From": "杏汁豬肺湯功效"
      },
      {
        "Bad": "舀出豬肺湯連同湯渣料盛入碗中，即可享用這碗潤肺滋補的杏汁豬肺湯。",
        "Good": "刪掉",
        "Reason": "",
        "Guide": "裝入碗中不是選項，是必然，必然的可以不用在結尾提到",
        "ErrorType": "語法錯誤",
        "Process": "修正",
        "Section": "",
        "From": "杏汁豬肺湯功效"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "文化意義需簡短，並置於脈絡與介紹段落中一兩句描述，不要單獨描述",
        "ErrorType": "",
        "Process": "",
        "Section": "文化",
        "From": "杏汁豬肺湯功效"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "faq 要直接寫問題，開頭不要 Q, A, ”答：\" 等格式",
        "ErrorType": "",
        "Process": "",
        "Section": "常見問題",
        "From": "杏汁豬肺湯功效"
      },
      {
        "Bad": "深受港澳臺地區喜愛",
        "Good": "深受多人喜愛",
        "Reason": "",
        "Guide": "",
        "ErrorType": "",
        "Process": "",
        "Section": "",
        "From": "粉葛淮山湯功效"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "步驟不要 **前處理：** 冒號 分隔，請直接寫文字敘述",
        "ErrorType": "",
        "Process": "",
        "Section": "食譜 步驟",
        "From": "粉葛淮山湯功效"
      },
      {
        "Bad": "先用大火將湯水煮滾",
        "Good": "先用大火煮滾",
        "Reason": "",
        "Guide": "同一個上下句，下一句可省略同樣的受詞",
        "ErrorType": "語法錯誤",
        "Process": "修正",
        "Section": "",
        "From": "粉葛淮山湯功效"
      },
      {
        "Bad": "讓食材的精華充分釋放到湯",
        "Good": "",
        "Reason": "",
        "Guide": "",
        "ErrorType": "冗言",
        "Process": "刪除",
        "Section": "",
        "From": "粉葛淮山湯功效"
      },
      {
        "Bad": "大滾約10分鐘",
        "Good": "約10分鐘",
        "Reason": "",
        "Guide": "上下句，上句的動作詞可以在下句省略",
        "ErrorType": "語法錯誤",
        "Process": "修正",
        "Section": "",
        "From": "粉葛淮山湯功效"
      },
      {
        "Bad": "この「焯水」步驟能去除豬骨異味與雜質，讓湯底更清澈。",
        "Good": "刪掉",
        "Reason": "",
        "Guide": "不要針對『步驟』本身做解釋",
        "ErrorType": "冗言",
        "Process": "刪除",
        "Section": "",
        "From": "粉葛淮山湯功效"
      },
      {
        "Bad": "慢煮約2小時，讓食材的精華充分釋放到湯中。",
        "Good": "慢煮約2小時",
        "Reason": "",
        "Guide": "好的句子，食材應該是受詞名詞，而非形容詞",
        "ErrorType": "語法錯誤",
        "Process": "修正",
        "Section": "",
        "From": "粉葛淮山湯功效"
      },
      {
        "Bad": "即可享用熱騰騰的粉葛淮山湯。",
        "Good": "即可享用",
        "Reason": "",
        "Guide": "上下句中，下句的主詞應該省略",
        "ErrorType": "語法錯誤",
        "Process": "修正",
        "Section": "",
        "From": "粉葛淮山湯功效"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "健康功效應置於食譜段落之前",
        "ErrorType": "格式錯誤",
        "Process": "修正",
        "Section": "Template",
        "From": "粉葛淮山湯功效"
      },
      {
        "Bad": "全指南：三大藥材功效與3款養生食譜詳解",
        "Good": "三大藥材功效與3款養生食譜詳解",
        "Reason": "",
        "Guide": "刪除全指南： ，直接將全指南重點寫出來",
        "ErrorType": "格式錯誤",
        "Process": "修正",
        "Section": "",
        "From": "消炎解毒湯水"
      },
      {
        "Bad": "魚腥草\n**中醫屬性：**魚腥草又稱折耳根，味辛，性寒，歸肺經，被譽為「天然抗生素」， ",
        "Good": "魚腥草\n**中醫屬性：**魚腥草又稱折耳根，味辛，性寒，歸肺經，被譽為「天然抗生素」， ，。魚腥草常用於煲湯或涼茶。因其性寒，多與豬骨、生薑等溫性食材同煮，以平衡寒性。加入蘋果、蜜棗等可調和魚腥味，使湯味更清甜。魚腥草在湯中能清肺熱、解毒消炎，對喉嚨痛、咳嗽等有舒緩作用。",
        "Reason": "",
        "Guide": "藥材解釋在短標題的引言，不要將解釋說明文放到子清單中",
        "ErrorType": "",
        "Process": "",
        "Section": "食譜 清單",
        "From": "消炎解毒湯水"
      },
      {
        "Bad": "魚腥草豬骨湯\n材料：",
        "Good": "魚腥草豬骨湯\n此湯清甜可口，帶有淡淡的草本香和果香。\n材料：",
        "Reason": "",
        "Guide": "食譜部分，先對食譜提供簡單說明，解釋自己的收穫（可長可短）",
        "ErrorType": "",
        "Process": "",
        "Section": "食譜",
        "From": "消炎解毒湯水"
      },
      {
        "Bad": "猴頭菇湯水都是兼顧營養與美味的理想選擇。",
        "Good": "猴頭菇湯水都是兼顧營養與美味的理想選擇。今次分享猴頭菇湯食譜與功效，以及一些對猴頭菇的常見疑問解答。\n",
        "Reason": "",
        "Guide": "若上下文段落差很多，先提供簡單的句子做說明",
        "ErrorType": "格式錯誤",
        "Process": "",
        "Section": "",
        "From": "消炎解毒湯水"
      },
      {
        "Bad": "猴頭菇湯水都是兼顧營養與美味的理想選擇。",
        "Good": "猴頭菇湯水兼顧營養與美味。\n",
        "Reason": "",
        "Guide": "不要使用 是 ...的理解選擇，句型應使用簡單名詞做結尾",
        "ErrorType": "冗言",
        "Process": "刪除",
        "Section": "",
        "From": "猴頭菇湯"
      },
      {
        "Bad": "盛碗後可視喜好撒上少許香菜增添清香。這款猴頭菇湯口感鮮甜醇厚，菇香濃郁，老少皆宜。",
        "Good": "盛碗後可視喜好撒上少許香菜增添清香。",
        "Reason": "",
        "Guide": "段落結尾處，請提供與上下文有關的內容",
        "ErrorType": "冗言",
        "Process": "刪除",
        "Section": "",
        "From": "猴頭菇湯"
      },
      {
        "Bad": "現代人長期處在冷氣空調環境或城市污染中，容易出現喉嚨乾癢、乾咳無痰等不適。",
        "Good": "",
        "Reason": "",
        "Guide": "情境描寫句子，只能使用職業相關主詞，如中醫，不應使用現代人",
        "ErrorType": "冗言",
        "Process": "刪除",
        "Section": "",
        "From": "猴頭菇湯"
      },
      {
        "Bad": "不用淹過梨，水位約至梨身中部即可",
        "Good": "水位約至梨身中部即可",
        "Reason": "",
        "Guide": "上下句目的一樣，可省略一句，只用正面的句子",
        "ErrorType": "冗言",
        "Process": "刪除",
        "Section": "",
        "From": "猴頭菇湯"
      },
      {
        "Bad": "食材差異（相對本食譜）",
        "Good": "食材差異",
        "Reason": "",
        "Guide": "表格標題不要()",
        "ErrorType": "格式錯誤",
        "Process": "修正",
        "Section": "",
        "From": "霸王花鴨腎淮山湯"
      },
      {
        "Bad": "材料：陳皮 1小塊 – 浸軟刮去白囊；陳皮芳香健脾、祛濕理氣，少量加入可提升湯品風味（沒有也可省略）。",
        "Good": "材料：陳皮 1小塊",
        "Reason": "",
        "Guide": "處理方式應放置於步驟，而非材料清單，也不需要（）",
        "ErrorType": "",
        "Process": "",
        "Section": "",
        "From": "霸王花鴨腎淮山湯"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "所有材料（除食鹽外），當（）前是所有等概括性詞彙，可以使用（）",
        "ErrorType": "",
        "Process": "",
        "Section": "",
        "From": "霸王花鴨腎淮山湯"
      },
      {
        "Bad": "",
        "Good": "",
        "Reason": "",
        "Guide": "標題提到關鍵字，要【】",
        "ErrorType": "風格要求",
        "Process": "修正",
        "Section": "",
        "From": "霸王花鴨腎淮山湯"
      }
    ]

}
]

export const MEDIA_SITE_FINE_TUNE_DATA = [{
    "name": "urban-life-fine-tune",
    "tag": "UL",
    "date": "2025-04-18",
    "data_set_description": "這個資料集是針對都市生活文章的優化，主要針對都市生活文章的結構進行優化，包括都市生活文章的結構、都市生活文章的內容、都市生活文章的格式等。",
    "data": [
      {
        "Guide": "標題提到關鍵字，要【】"
      }
    ]
}]


export const LANGUAGE_FINE_TUNE_DATA = [
  {
    "name": "language-fine-tune",
    "tag": "language",
    "date": "2025-04-18",
    "data_set_description": "這個資料集是針對中文繁體的錯字進行優化，主要針對中文繁體的錯字進行優化，包括中文繁體的錯字、中文繁體的錯字、中文繁體的錯字等。",
    "data": [
      {
        "Error": "薏苡仁",
        "Correct": "薏米"
      },
      {
        "Error": "大火猛沸",
        "Correct": "大火猛滾"
      },
      {
        "Error": "祛濕利水",
        "Correct": "去濕利水"
      },
      {
        "Error": "醫師",
        "Correct": "醫生"
      },
      {
        "Error": "維生素",
        "Correct": "維他命"
      }
    ]
  },
  {
    "name": "language-fine-tune-hk",
    "tag": "hk",
    "date": "2025-04-18",
    "data_set_description": "這個資料集是針對香港繁體的錯字進行優化，主要針對香港繁體的錯字進行優化，包括香港繁體的錯字、香港繁體的錯字、香港繁體的錯字等。",
    "data": [
      {
        "HK": "粟玉",
        "TW": "玉米"
      },
      {
        "HK": "豬肉檔",
        "TW": "小販"
      },
      {
        "HK": "沸",
        "TW": "滾"
      },
      {
        "HK": "節瓜",
        "TW": "毛瓜"
      },
      {
        "HK": "捱夜",
        "TW": "熬夜"
      }
    ]
}]