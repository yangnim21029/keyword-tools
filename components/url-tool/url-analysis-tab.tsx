'use client';

import {
  getSearchVolume,
  getUrlSuggestions,
  saveClustersToHistory
} from '@/app/actions';
import { SearchVolumeResult, SuggestionsResult } from '@/app/types';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import type { SearchHistoryItem } from '@/lib/schemas'; // Assume type includes 'type'
import { useSearchStore } from '@/store/searchStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

// Extend SearchHistoryItem locally
interface ExtendedSearchHistoryItem extends SearchHistoryItem {
    type: 'keyword' | 'url' | 'serp';
    url?: string; // Add optional url property
}

interface UrlAnalysisTabProps {
	researchDetail?: ExtendedSearchHistoryItem | null;
	globalSearchInput?: string;
}

export default function UrlAnalysisTab({
	researchDetail,
	globalSearchInput,
}: UrlAnalysisTabProps) {
	// 本地狀態
	const [url, setUrl] = useState('');
	const [suggestions, setSuggestions] = useState<SuggestionsResult>({ suggestions: [], estimatedProcessingTime: 0 });
	const [volumeData, setVolumeData] = useState<SearchVolumeResult>({ results: [], processingTime: { estimated: 0, actual: 0 } });
	const [clusters, setClusters] = useState<any>(null);
	const [isClustering, setIsClustering] = useState(false);
	const [clusteringText, setClusteringText] = useState('');
	const [step, setStep] = useState<'input' | 'suggestions' | 'volumes' | 'clusters'>('input');
	const [error, setError] = useState<string | null>(null);
	
	// 使用全局加載狀態
	const isLoading = useSearchStore(store => store.state.isLoading);
	const setGlobalLoading = useSearchStore(store => store.actions.setLoading);

	// 從 Provider 獲取設置
	const settingsState = useSettingsStore(state => state.state);
	const {
		region,
		language,
		filterZeroVolume,
		maxResults,
	} = settingsState;

	// 監聽全局搜索輸入變化 - 只更新 url 狀態
	useEffect(() => {
		if (globalSearchInput !== undefined) {
			setUrl(globalSearchInput);
			// 不再自動觸發分析，由全局按鈕觸發
		}
	}, [globalSearchInput]);

	// Load data from researchDetail prop
	useEffect(() => {
		if (researchDetail && researchDetail.type === 'url') {
			console.log("URL Tab received detail:", researchDetail);
			setUrl(researchDetail.url || researchDetail.mainKeyword || ''); 
			setSuggestions({ 
				suggestions: researchDetail.suggestions || [], 
				estimatedProcessingTime: 0 // Reset or get from history if available
			});
			setVolumeData({ 
				results: researchDetail.searchResults || [], 
				processingTime: { estimated: 0, actual: 0 }, // Reset or get from history
				fromCache: true // Indicate data is from history
			});
			setClusters(researchDetail.clusters || null); 
			
			// Determine the initial step
			const nextStep = researchDetail.clusters ? 'clusters' 
					: researchDetail.searchResults?.length ? 'volumes' 
					: researchDetail.suggestions?.length ? 'suggestions' 
					: 'input';
			setStep(nextStep);
			setError(null);
		}
	}, [researchDetail]);

	// 取得 URL 建議
	const handleGetUrlSuggestions = async () => {
		if (!url.trim()) { return; }
		
		setGlobalLoading(true, '分析URL中...');
		setError(null);
		// 清空舊數據
		setSuggestions({ suggestions: [], estimatedProcessingTime: 0 });
		setVolumeData({ results: [], processingTime: { estimated: 0, actual: 0 } });
		setClusters(null);
		setStep('input'); 
		
		try {
			const result = await getUrlSuggestions({ url, region, language });
			
			if (result.sourceInfo) {
				toast.info(result.sourceInfo);
			}
			if (result.error) {
				toast.error(result.error);
				throw new Error(result.error);
			}

			setSuggestions(result);
			setStep('suggestions');
			
		} catch (error) {
			console.error('URL 分析失敗:', error);
			const message = error instanceof Error ? error.message : 'URL 分析失敗，請稍後再試';
			if (!message.startsWith('數據來源:')) {
				 toast.error(message);
			}
			setError(message);
		} finally {
			setGlobalLoading(false);
		}
	};

	// 獲取搜索量數據
	const handleGetVolumes = async () => {
		if (suggestions.suggestions.length === 0) {
			toast.warning('沒有可用的關鍵詞建議');
			return;
		}
		
		setGlobalLoading(true, `獲取搜索量數據中...\n預估需時：${suggestions.estimatedProcessingTime} 秒`);
		setError(null);
		
		try {
			const result = await getSearchVolume(suggestions.suggestions, region, url, language);
			
			if (result.sourceInfo) {
				toast.info(result.sourceInfo);
			}
			if (result.error) {
				toast.error(result.error);
				throw new Error(result.error);
			}

			let sortedResults = [...result.results].sort((a, b) => b.searchVolume - a.searchVolume);
			if (filterZeroVolume) {
				sortedResults = sortedResults.filter(item => item.searchVolume > 0);
			}
			if (maxResults > 0 && sortedResults.length > maxResults) {
				sortedResults = sortedResults.slice(0, maxResults);
			}
			
			setVolumeData({
				...result,
				results: sortedResults
			});
			setStep('volumes');
			
			if (result.processingTime && result.processingTime.actual) {
				console.log(`實際處理時間: ${result.processingTime.actual} 秒 (預估: ${result.processingTime.estimated} 秒)`);
			}
			
		} catch (error) {
			console.error('獲取搜索量失敗:', error);
			const message = error instanceof Error ? error.message : '獲取搜索量失敗，請稍後再試';
			if (!message.startsWith('數據來源:')) {
				 toast.error(message);
			}
			setError(message);
		} finally {
			setGlobalLoading(false);
		}
	};

	// 生成語意分群
	const handleClustering = async () => {
		if (volumeData.results.length < 5) {
			alert('至少需要 5 個關鍵詞才能進行分群');
			return;
		}
		
		setIsClustering(true);
		setGlobalLoading(true, '準備語意分群...');
		setClusters(null);
		setClusteringText(''); // 清空聚類文本
		
		const controller = new AbortController();
		const timeoutId = setTimeout(() => {
			controller.abort();
			alert('語意分群請求超時 (60秒)');
			setIsClustering(false);
			setGlobalLoading(false);
		}, 60000); // 設置 60 秒超時
		
		try {
			// 獲取關鍵詞
			const keywords = volumeData.results.map(item => (item as any).text || (item as any).keyword);
			
			// 變更加載文本
			setGlobalLoading(true, '請求 AI 分群中 (可能需要一些時間)...');
			
			// --- 切換回調用 API Route --- 
			const response = await fetch('/api/semantic-clustering', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ 
					keywords: keywords.slice(0, 100) // 限制關鍵詞數量為 100
				}),
				signal: controller.signal, // 附加超時控制器
			});
			
			clearTimeout(timeoutId); // 清除超時計時器
			
			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`伺服器錯誤 ${response.status}: ${errorText || response.statusText}`);
			}
			
			if (!response.body) {
				throw new Error('無法讀取伺服器回應流');
			}
			
			// --- 處理流式響應 --- 
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let receivedText = '';
			let parsedData: any = null;
			
			setGlobalLoading(true, '接收 AI 分群結果...');
			
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				// 解碼並添加到接收的文本
				receivedText += decoder.decode(value, { stream: true });
				setClusteringText(receivedText); // 實時更新顯示的文本
				
				// 嘗試解析當前接收到的文本為 JSON
				try {
					// 嘗試提取 JSON 部分（處理可能的非 JSON 文本）
					const jsonMatch = receivedText.match(/\{[\s\S]*\}/); // 寬鬆匹配 { ... }
					if (jsonMatch && jsonMatch[0]) {
						parsedData = JSON.parse(jsonMatch[0]);
						// 如果解析成功且包含 clusters，可以考慮在這裡更新狀態（但最好等流結束）
						// if (parsedData.clusters) { ... }
					}
				} catch (e) {
					// JSON 尚未完成或格式不正確，繼續讀取
					// console.log('接收流數據中...');
				}
			}
			
			// 確保最終解碼完成
			receivedText += decoder.decode();
			setClusteringText(receivedText); // 更新最終的完整文本
			
			// --- 解析最終結果 --- 
			setGlobalLoading(true, '解析分群結果...');
			try {
				// 優先嘗試解析之前流處理中可能已解析的數據
				let finalJsonResult = parsedData;
				
				// 如果流處理中沒有成功解析，嘗試解析最終的完整文本
				if (!finalJsonResult) {
                    const jsonMatch = receivedText.match(/\{[\s\S]*\}/); // 再次嘗試提取
                    if (jsonMatch && jsonMatch[0]) {
                        finalJsonResult = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('無法在最終輸出中找到有效的 JSON 結構');
                    }
                }
				
				console.log('最終解析的 JSON 對象:', finalJsonResult);

				if (finalJsonResult && finalJsonResult.clusters && Object.keys(finalJsonResult.clusters).length > 0) {
					const clusterCount = Object.keys(finalJsonResult.clusters).length;
					console.log('成功解析聚類數據:', clusterCount, '個分群');
					setClusters(finalJsonResult.clusters);
					setStep('clusters');
					
					// 在分群結果處理部分更新代碼
					if (url) {
						try {
							console.log('處理分群結果，共', clusterCount, '個分群');
							
							// 使用伺服器動作保存分群結果到新記錄
							const result = await saveClustersToHistory(
								url,
								region,
								language,
								suggestions.suggestions,
								volumeData.results,
								finalJsonResult.clusters
							);
							
							if (result.success) {
								console.log('已保存分群結果到新的歷史記錄', result.historyId || '');
								// 添加明確的成功提示
								alert(`已成功創建 ${clusterCount} 個分群，並保存到歷史記錄中！`);
							} else {
								console.error('保存分群結果失敗:', result.error);
							}
						} catch (saveError) {
							console.error('保存/更新分群結果到歷史失敗:', saveError);
						}
					}
				} else if (finalJsonResult && finalJsonResult.error) {
					// 處理後端返回的已知錯誤
					console.error('後端返回錯誤:', finalJsonResult);
					alert(`聚類失敗: ${finalJsonResult.message || finalJsonResult.error}`);
				} else {
					console.error('解析後的 JSON 結果缺少 clusters 屬性或分群為空');
					alert('聚類結果格式不正確或未包含有效分群，請查看原始輸出');
				}
			} catch (parseError) {
				console.error('無法解析最終的聚類結果 JSON:', parseError, '原始文本:', receivedText);
				alert('聚類結果格式錯誤，請查看原始輸出');
			}
		} catch (error: any) {
			console.error('語意分群失敗:', error);
			if (error.name === 'AbortError') {
				// 超時錯誤已被處理
			} else {
				alert(`語意分群失敗: ${error.message || '未知錯誤'}`);
			}
		} finally {
			clearTimeout(timeoutId); // 確保超時被清除
			setIsClustering(false);
		}
	};

	const handleSaveClusters = () => {
		// Simplified logic: Always save as a new history record
		if (!clusters) {
			toast.error("沒有可保存的分群結果。");
			return;
		}
		if (!url || !region || !language) { // Add checks for necessary data
			toast.error("缺少必要的參數（URL, 地區, 語言）無法保存。");
			return;
		}

		console.log('準備保存分群結果到新的歷史記錄...');
		saveClustersToHistory(
			url, 
			region,
			language,
			suggestions.suggestions, 
			volumeData.results,
			clusters 
		).then(result => {
			if (result.success) {
				console.log('已保存分群結果到新的歷史記錄', result.historyId || '');
				toast.success(`已成功保存分群結果到歷史記錄！`);
			} else {
				console.error('保存分群結果失敗:', result.error);
				toast.error(`保存分群結果失敗: ${result.error}`);
			}
		}).catch(error => {
			console.error('調用 saveClustersToHistory 時出錯:', error);
			toast.error(`保存時發生錯誤: ${error instanceof Error ? error.message : String(error)}`);
		});
	};

	return (
		<div className="space-y-6">
			{/* Restore original UI or adapt as needed without history props */}
			{/* Example: Likely contains the form/input and results display */}
			<p>URL Analysis Tab Content (History Removed)</p>
			{/* Ensure handleGetUrlSuggestions, handleGetVolumes, etc. still work */}
			<LoadingButton id="url-analysis-submit" onClick={handleGetUrlSuggestions} style={{ display: 'none' }} isLoading={isLoading}>Submit</LoadingButton>

			{/* Display results based on local state (suggestions, volumeData, clusters) */}
			{(suggestions.suggestions.length > 0 || volumeData.results.length > 0) && (
				<div className="flex items-center space-x-2 mb-4">
					{/* Button logic might need adjustment if saving/updating history is removed/changed */}
					{step === 'volumes' && (
						<LoadingButton 
							onClick={handleGetVolumes}
							isLoading={isLoading}
						>
							獲取搜索量 {/* ... count span ... */}
						</LoadingButton>
					)}
					{step === 'clusters' && clusters && (
						<Button 
							onClick={handleSaveClusters}
							disabled={isLoading || isClustering}
							variant="outline"
							className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium shadow-sm transition-colors"
						>
							<Save className="h-4 w-4 mr-1" />
							保存分群到歷史 
						</Button>
					)}
				</div>
			)}
			{/* ... rest of the results display logic ... */}
			{researchDetail && (
				<div className="mt-4 p-2 bg-blue-100 dark:bg-blue-900 rounded border border-blue-300 dark:border-blue-700">
					<p className="text-sm">Loaded from Research: {researchDetail.mainKeyword || researchDetail.url}</p>
				</div>
			)}
		</div>
	);
} 