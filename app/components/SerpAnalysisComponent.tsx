const renderSearchResult = (result: any, index: number) => (
  <div key={index} className="mb-6 p-4 bg-white rounded-lg shadow">
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-semibold">
        {result.position}
      </div>
      <div className="flex-grow">
        <a 
          href={result.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-lg font-medium text-blue-600 hover:text-blue-800 mb-2 block"
        >
          {result.title}
        </a>
        <p className="text-gray-600 text-sm mb-2">{result.displayUrl}</p>
        <p className="text-gray-700">{result.description}</p>
        
        {/* 顯示 HTML 分析結果 */}
        {result.htmlAnalysis && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">HTML 分析結果：</h4>
            
            {/* H1 標題 */}
            {result.htmlAnalysis.h1 && result.htmlAnalysis.h1.length > 0 && (
              <div className="mb-3">
                <h5 className="font-medium text-gray-700 mb-1">H1 標題：</h5>
                <ul className="list-disc list-inside">
                  {result.htmlAnalysis.h1.map((h1: string, idx: number) => (
                    <li 
                      key={idx}
                      className={`text-sm ${
                        result.htmlAnalysis.h1Consistency 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}
                    >
                      {h1}
                      {result.htmlAnalysis.h1Consistency 
                        ? ' (與關鍵詞一致)' 
                        : ' (與關鍵詞不一致)'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* H2 標題 */}
            {result.htmlAnalysis.h2 && result.htmlAnalysis.h2.length > 0 && (
              <div className="mb-3">
                <h5 className="font-medium text-gray-700 mb-1">H2 標題：</h5>
                <ul className="list-disc list-inside">
                  {result.htmlAnalysis.h2.map((h2: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-600">{h2}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* H3 標題 */}
            {result.htmlAnalysis.h3 && result.htmlAnalysis.h3.length > 0 && (
              <div className="mb-3">
                <h5 className="font-medium text-gray-700 mb-1">H3 標題：</h5>
                <ul className="list-disc list-inside">
                  {result.htmlAnalysis.h3.map((h3: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-600">{h3}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
); 