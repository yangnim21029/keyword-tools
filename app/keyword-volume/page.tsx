'use server';

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { COLLECTIONS, db, getKeywordVolumeList } from '../services/firebase';
import KeywordVolumeObjectList from './components/keyword-obj-list';
import KeywordSearchForm from './components/keyword-search-form';
import { RevalidateButton } from '../actions/actions-buttons';

export default async function KeywordToolPage() {
  if (!db) return notFound();
  const countSnapshot = await db
    .collection(COLLECTIONS.KEYWORD_VOLUME)
    .count()
    .get();
  const totalCount = countSnapshot.data().count;

  const keywordVolumeList = await getKeywordVolumeList({ limit: 50 });

  return (
    // Main container to center content, remove grid
    <div className="container mx-auto px-4 py-10 min-h-screen">
      <div className="flex flex-col md:flex-row md:gap-x-12 lg:gap-x-16 items-center">
        <div className="flex flex-col items-center w-full md:flex-1">
          <div className="text-center mb-6 w-full max-w-xl">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-200">
              你正在查詢？
            </h1>
            <p className="text-md text-muted-foreground mt-2">
              已有{' '}
              <strong className="text-primary">
                {totalCount.toLocaleString()}
              </strong>{' '}
              次關鍵字研究完成！ 更多的人正在為他們的文章，找到合適的關鍵字！
            </p>
          </div>
          <div className="w-full max-w-xl">
            <Suspense fallback={<div>Loading search form...</div>}>
              <KeywordSearchForm />
            </Suspense>
          </div>
        </div>

        <div className="w-full md:w-[350px] lg:w-[400px] mt-10 md:mt-0 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-left">研究記錄</h2>
            <RevalidateButton size="sm" variant="ghost" />
          </div>
          <KeywordVolumeObjectList
            keywordVolumeObjectList={keywordVolumeList ?? []}
          />
        </div>
      </div>
    </div>
  );
}
