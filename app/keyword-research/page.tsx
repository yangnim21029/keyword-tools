import DeleteResearchButton from '@/components/keyword-research/delete-research-button';
import { Button } from '@/components/ui/button';
import type { SearchHistoryItem } from '@/lib/schemas';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default async function KeywordResearchPage() {
  let researchItems: SearchHistoryItem[] = [];
  let error: string | null = null;

  try {
    researchItems = await getSearchHistoryList();
    
    researchItems = researchItems.map(item => ({ /* ... mapping ... */ }));

    researchItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  } catch (fetchError) {
    console.error('[Keyword Research Page] Failed to fetch research list:', fetchError);
    error = fetchError instanceof Error ? fetchError.message : '無法加載關鍵詞研究記錄';
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <Card>
        <CardHeader>
          <CardTitle>關鍵詞研究記錄</CardTitle>
          <CardDescription>查看您過去的關鍵詞搜索和 URL 分析記錄。</CardDescription>
        </CardHeader>
        <CardContent>
          {!error && researchItems.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-10">
              <p>目前沒有關鍵詞研究記錄。</p>
            </div>
          )}
          {!error && researchItems.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableBody>
                  {researchItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium truncate max-w-[200px] sm:max-w-[300px]">
                        <Link href={`/keyword-research/${item.id}`} className="hover:underline hover:text-blue-600 dark:hover:text-blue-400">
                          {item.mainKeyword || item.url || 'N/A'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Link href={`/keyword-research/${item.id}`} passHref legacyBehavior>
                            <Button variant="ghost" size="icon" className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 h-7 w-7" aria-label="查看詳情">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>
                          <DeleteResearchButton historyId={item.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 