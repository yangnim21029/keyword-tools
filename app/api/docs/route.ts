import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiDocs = {
    apis: [
      {
        endpoint: '/api/keyword-idea',
        description: '獲取關鍵字研究結果',
        methods: ['GET', 'POST'],
        parameters: {
          query: '關鍵字或URL (必填)',
          region: '區域代碼 (預設: TW)',
          language: '語言代碼 (預設: zh-TW)',
          useAlphabet: '是否包含字母變體 (true/false, 預設: false)',
          useSymbols: '是否包含符號變體 (true/false, 預設: false)',
          minSearchVolume: '最小搜索量過濾 (可選)'
        },
        examples: {
          javascript: `
// 使用 fetch API
async function getKeywordIdeas() {
  const response = await fetch('/api/keyword-idea?query=seo工具&region=TW&language=zh-TW');
  const data = await response.json();
  console.log(data);
}

// POST 請求示例
async function postKeywordIdeas() {
  const response = await fetch('/api/keyword-idea', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'seo工具',
      region: 'TW',
      language: 'zh-TW',
      useAlphabet: true,
      useSymbols: false,
      minSearchVolume: 100
    }),
  });
  const data = await response.json();
  console.log(data);
}`,
          python: `
# 使用 requests 庫
import requests

# GET 請求示例
def get_keyword_ideas():
    response = requests.get(
        'https://your-domain.com/api/keyword-idea',
        params={
            'query': 'seo工具',
            'region': 'TW',
            'language': 'zh-TW',
            'useAlphabet': 'true',
            'useSymbols': 'false',
            'minSearchVolume': '100'
        }
    )
    data = response.json()
    print(data)

# POST 請求示例
def post_keyword_ideas():
    response = requests.post(
        'https://your-domain.com/api/keyword-idea',
        json={
            'query': 'seo工具',
            'region': 'TW',
            'language': 'zh-TW',
            'useAlphabet': True,
            'useSymbols': False,
            'minSearchVolume': 100
        }
    )
    data = response.json()
    print(data)`,
          curl: `
# GET 請求示例
curl -X GET 'https://your-domain.com/api/keyword-idea?query=seo%E5%B7%A5%E5%85%B7&region=TW&language=zh-TW'

# POST 請求示例
curl -X POST 'https://your-domain.com/api/keyword-idea' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "query": "seo工具",
    "region": "TW",
    "language": "zh-TW",
    "useAlphabet": true,
    "useSymbols": false,
    "minSearchVolume": 100
  }'`
        }
      },
      {
        endpoint: '/api/suggestions',
        description: '獲取關鍵字建議',
        methods: ['GET'],
        parameters: {
          query: '關鍵字 (必填)',
          region: '區域代碼 (預設: TW)',
          language: '語言代碼 (預設: zh-TW)',
          useAlphabet: '是否包含字母變體 (true/false, 預設: false)',
          useSymbols: '是否包含符號變體 (true/false, 預設: false)'
        },
        examples: {
          javascript: `
// 使用 fetch API
async function getKeywordSuggestions() {
  const response = await fetch('/api/suggestions?query=SEO&region=TW&language=zh-TW');
  const data = await response.json();
  console.log(data);
}`,
          python: `
# 使用 requests 庫
import requests

def get_keyword_suggestions():
    response = requests.get(
        'https://your-domain.com/api/suggestions',
        params={
            'query': 'SEO',
            'region': 'TW',
            'language': 'zh-TW',
            'useAlphabet': 'true',
            'useSymbols': 'false'
        }
    )
    data = response.json()
    print(data)`,
          curl: `
# GET 請求示例
curl -X GET 'https://your-domain.com/api/suggestions?query=SEO&region=TW&language=zh-TW'`
        }
      }
    ]
  };

  return NextResponse.json(apiDocs);
} 