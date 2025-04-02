'use client';

import {
    getSearchVolume,
    getUrlSuggestions,
    saveClustersToHistory,
    updateHistoryWithClusters
} from '@/app/actions';
import { SearchVolumeResult, SuggestionsResult } from '@/app/types';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryStore } from '@/store/queryStore';
import { LayoutGrid, Save } from "lucide-react";
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface UrlAnalysisTabProps {
	activeTab: 'keyword' | 'url' | 'serp' | 'settings';
	region: string;
	language: string;
	regions: Record<string, string>;
	languages: Record<string, string>;
	onRegionChange: (value: string) => void;
	onLanguageChange: (value: string) => void;
	filterZeroVolume: boolean;
	maxResults: number;
	selectedHistoryDetail: any | null;
	onHistoryLoaded: (historyDetail: any) => void;
	globalSearchInput?: string;
}

export default function UrlAnalysisTab({
	activeTab,
	region,
	language,
	regions,
	languages,
	onRegionChange,
	onLanguageChange,
	filterZeroVolume,
	maxResults,
	selectedHistoryDetail,
	onHistoryLoaded,
	globalSearchInput
}: UrlAnalysisTabProps) {
	// 本地狀態
	const [url, setUrl] = useState('');
	const [suggestions, setSuggestions] = useState<SuggestionsResult>({ suggestions: [], estimatedProcessingTime: 0 });
	const [volumeData, setVolumeData] = useState<SearchVolumeResult>({ results: [], processingTime: { estimated: 0, actual: 0 } });
	const [clusters, setClusters] = useState<any>(null);
	const [isClustering, setIsClustering] = useState(false);
	const [clusteringText, setClusteringText] = useState('');
	const [step, setStep] = useState<'input' | 'suggestions' | 'volumes' | 'clusters'>('input');
	const [estimatedTime, setEstimatedTime] = useState<number>(0);
	const [urlData, setUrlData] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);
	
	// 使用全局加載狀態
	const isLoading = useQueryStore(store => store.state.isLoading);
	const setGlobalLoading = useQueryStore(store => store.actions.setLoading);

	// 監聽 selectedHistoryDetail 變化，加載歷史數據
	useEffect(() => {
		if (selectedHistoryDetail && activeTab === 'url') {
			loadUrlData(selectedHistoryDetail);
			// 通知父組件歷史記錄已加載
			onHistoryLoaded(selectedHistoryDetail);
		}
	}, [selectedHistoryDetail, activeTab, onHistoryLoaded]);

	// 監聽全局搜索輸入變化 - 只更新 url 狀態
	useEffect(() => {
		if (globalSearchInput !== undefined && activeTab === 'url') {
			setUrl(globalSearchInput);
			// 不再自動觸發分析，由全局按鈕觸發
		}
	}, [globalSearchInput, activeTab]);

	// 加載 URL 分析歷史數據
	const loadUrlData = (historyDetail: any) => {
		if (!historyDetail || historyDetail.type !== 'url') return;
		
		setUrl(historyDetail.url || '');
		
		if (historyDetail.searchResults?.length > 0) {
			setVolumeData({
				results: historyDetail.searchResults,
				processingTime: { estimated: 0, actual: 0 },
			});
			setStep('volumes');
		}
		
		// 加載分群結果
		if (historyDetail.clusters && Object.keys(historyDetail.clusters).length > 0) {
			console.log('從歷史記錄中加載分群數據:', Object.keys(historyDetail.clusters).length, '個分群');
			setClusters(historyDetail.clusters);
			setStep('clusters');
		}
	};

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
			setEstimatedTime(result.estimatedProcessingTime || 0);
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
		
		setGlobalLoading(true, `獲取搜索量數據中...\n預估需時：${estimatedTime} 秒`);
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
			const response = await fetch('/api/SemanticClustering', {
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
							
							// 檢查是否有歷史記錄ID（從歷史記錄加載的數據）
							if (selectedHistoryDetail && selectedHistoryDetail.id) {
								console.log('準備更新分群結果到歷史記錄 ID:', selectedHistoryDetail.id);
								
								// 使用歷史記錄ID更新分群結果
								const result = await updateHistoryWithClusters(
									selectedHistoryDetail.id,
									finalJsonResult.clusters
								);
								
								if (result.success) {
									console.log('已更新歷史記錄的分群結果');
									// 添加明確的成功提示
									alert(`已成功創建 ${clusterCount} 個分群，並更新到歷史記錄中！`);
								} else {
									console.error('更新分群結果失敗:', result.error);
								}
							} else {
								console.log('準備保存分群結果到新的歷史記錄...');
								
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

	return (
		<div className="space-y-6">
			{/* 移除原來的表單 */}
			{/* 全局搜索觸發 handleGetUrlSuggestions */}
			{/* 需要一個隱藏或標識的按鈕供全局點擊 */}
			<LoadingButton id="url-analysis-submit" onClick={handleGetUrlSuggestions} style={{ display: 'none' }} isLoading={isLoading}>Submit</LoadingButton>

			{/* 結果顯示區域 - 添加按鈕 */}
			{(suggestions.suggestions.length > 0 || volumeData.results.length > 0) && (
				<div className="flex items-center space-x-2 mb-4">
					{step === 'suggestions' && (
						<LoadingButton 
							onClick={handleGetVolumes}
							disabled={!suggestions.suggestions.length}
							variant="outline"
							className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium shadow-sm transition-colors"
							isLoading={isLoading}
						>
							獲取搜索量 {suggestions.suggestions.length > 0 && (
								<span className="ml-1.5 inline-block py-0.5 px-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
									{suggestions.suggestions.length}
								</span>
							)}
						</LoadingButton>
					)}
					{step === 'volumes' && (
						<LoadingButton 
							onClick={handleClustering}
							disabled={volumeData.results.length < 5}
							variant="outline"
							className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium shadow-sm transition-colors"
							isLoading={isClustering}
						>
							<LayoutGrid className="h-4 w-4 mr-1" />
							語意分群 {volumeData.results.length > 0 && (
								<span className="ml-1.5 inline-block py-0.5 px-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
									{volumeData.results.length}
								</span>
							)}
						</LoadingButton>
					)}
					{step === 'clusters' && clusters && (
						<Button 
							onClick={() => {
								// 檢查是否有歷史記錄ID（從歷史記錄加載的數據）
								if (selectedHistoryDetail && selectedHistoryDetail.id) {
									console.log('準備更新分群結果到歷史記錄 ID:', selectedHistoryDetail.id);
									
									// 使用歷史記錄ID更新分群結果
									updateHistoryWithClusters(
										selectedHistoryDetail.id,
										clusters
									).then(result => {
										if (result.success) {
											console.log('已更新歷史記錄的分群結果');
											alert(`已成功更新分群結果到歷史記錄！`);
										} else {
											console.error('更新分群結果失敗:', result.error);
											alert(`更新分群結果失敗: ${result.error}`);
										}
									});
								} else {
									console.log('準備保存分群結果到新的歷史記錄...');
									
									// 使用伺服器動作保存分群結果到新記錄
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
											alert(`已成功保存分群結果到歷史記錄！`);
										} else {
											console.error('保存分群結果失敗:', result.error);
											alert(`保存分群結果失敗: ${result.error}`);
										}
									});
								}
							}}
							disabled={isLoading || isClustering}
							variant="outline"
							className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium shadow-sm transition-colors"
						>
							<Save className="h-4 w-4 mr-1" />
							{selectedHistoryDetail && selectedHistoryDetail.id ? '更新分群到歷史' : '保存分群到歷史'}
						</Button>
					)}
				</div>
			)}
			
			{step === 'clusters' && clusters && (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* URL 相關關鍵詞建議結果 */}
					<Card className="p-4 border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm rounded-xl">
						<h3 className="text-base font-medium mb-2">分群結果</h3>
						<div className="overflow-y-auto h-[500px]">
							{clusters.map((cluster: any, clusterIndex: number) => (
								<div key={clusterIndex} className="mb-4 p-2 border border-gray-100 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900/50">
									<h4 className="text-sm font-semibold mb-1">分群 {clusterIndex + 1}</h4>
									<div className="flex flex-wrap gap-1">
										{cluster.keywords.map((keyword: string, keywordIndex: number) => (
											<Badge 
												key={keywordIndex} 
												variant="outline" 
												className="text-xs py-0.5 px-1.5 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
											>
												{keyword}
											</Badge>
										))}
									</div>
								</div>
							))}
						</div>
					</Card>

					{/* 搜索量數據結果 */}
					<Card className="p-4 border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm rounded-xl">
						<h3 className="text-base font-medium mb-2">搜索量數據</h3>
						<div className="overflow-y-auto h-[500px]">
							<Table>
								<TableHeader>
									<TableRow className="border-b border-gray-100 dark:border-gray-800">
										<TableHead>關鍵詞</TableHead>
										<TableHead className="text-right">搜索量</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{volumeData.results
										.sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0))
										.map((result, i) => (
											<TableRow key={i} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/30">
												<TableCell>{result.text}</TableCell>
												<TableCell className="text-right">{result.searchVolume || '無數據'}</TableCell>
											</TableRow>
										))}
								</TableBody>
							</Table>
						</div>
					</Card>
				</div>
			)}
			
			{/* 聚類流式文本顯示 */}
			{isClustering && clusteringText && (
				<div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl">
					<pre className="whitespace-pre-wrap text-sm">{clusteringText}</pre>
				</div>
			)}
		</div>
	);
} 