'use client';

import { getRegions } from '@/app/actions';
import { usePathname } from 'next/navigation';
import HeaderControls from './header-controls';
import HeaderSearchBar from './header-search-bar';
import RegionLanguageSelectors from './region-language-selectors';

interface HeaderClientProps {
  initialRegionsData: Awaited<ReturnType<typeof getRegions>>;
}

export default function HeaderClient({
  initialRegionsData,
}: HeaderClientProps) {
  const pathname = usePathname();

  return (
    <div className="flex items-center border-b border-gray-200 dark:border-gray-800 py-3 px-4 gap-2 shadow-sm">
      <RegionLanguageSelectors initialRegionsData={initialRegionsData} />
      <HeaderSearchBar />
      <HeaderControls />
    </div>
  );
} 