'use client';

import { SubmitKeywordResearchButton } from '@/app/actions/actions-buttons';
import { LANGUAGES, REGIONS } from '@/app/global-config';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Globe, Languages as LanguagesIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useState } from 'react';

export default function KeywordSearchForm() {
  // --- Hooks ---
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // --- Local State ---
  const [queryInput, setQueryInput] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>(() => {
    return searchParams.get('region') || Object.values(REGIONS)[0] || '';
  });
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return searchParams.get('language') || Object.keys(LANGUAGES)[0] || '';
  });
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);

  // --- Logic ---

  useEffect(() => {
    const initialQueryFromUrl = searchParams.get('q');
    if (initialQueryFromUrl && !queryInput) {
      setQueryInput(decodeURIComponent(initialQueryFromUrl));
    }
    const initialRegion = searchParams.get('region');
    if (initialRegion && initialRegion !== selectedRegion) {
      setSelectedRegion(initialRegion);
    }
    const initialLanguage = searchParams.get('language');
    if (initialLanguage && initialLanguage !== selectedLanguage) {
      setSelectedLanguage(initialLanguage);
    }
  }, [searchParams, queryInput, selectedRegion, selectedLanguage]);

  const updateSearchParams = (key: string, value: string) => {
    const current = new URLSearchParams(searchParams.toString());
    if (value) {
      current.set(key, value);
    } else {
      current.delete(key);
    }
    const search = current.toString();
    const query = search ? `?${search}` : '';
    startTransition(() => {
      router.push(`${pathname}${query}`);
    });
  };

  const handleRegionChange = (value: string) => {
    setSelectedRegion(value);
    updateSearchParams('region', value);
    setRegionDialogOpen(false);
  };

  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value);
    updateSearchParams('language', value);
    setLanguageDialogOpen(false);
  };

  const getRegionName = (code: string) =>
    Object.entries(REGIONS).find(([_, c]) => c === code)?.[0] || code;
  const getLanguageName = (code: string) =>
    LANGUAGES[code as keyof typeof LANGUAGES] || code;

  // --- Render ---
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xl px-4">
      <div
        className={cn(
          'w-full bg-white p-3 rounded-2xl border border-gray-300 space-y-3',
          'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 transition-shadow duration-200'
        )}
      >
        <div className="relative w-full flex items-center">
          <Input
            type="text"
            placeholder="輸入關鍵字開始研究..."
            value={queryInput}
            onChange={e => setQueryInput(e.target.value)}
            className="h-12 text-lg pl-5 pr-5 w-full border-none ring-offset-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 bg-transparent shadow-none"
          />
        </div>

        <div className={cn('flex items-center justify-between pt-2 px-2')}>
          <div className="flex flex-wrap gap-2">
            <Dialog open={regionDialogOpen} onOpenChange={setRegionDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full h-8 px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-normal"
                >
                  <Globe size={14} className="mr-1.5" />
                  {getRegionName(selectedRegion)} ({selectedRegion})
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>選擇地區</DialogTitle>
                </DialogHeader>
                <Select
                  value={selectedRegion}
                  onValueChange={handleRegionChange}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="選擇地區" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REGIONS).map(([name, code]) => (
                      <SelectItem key={code} value={code}>
                        {name} ({code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DialogContent>
            </Dialog>

            <Dialog
              open={languageDialogOpen}
              onOpenChange={setLanguageDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full h-8 px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-normal"
                >
                  <LanguagesIcon size={14} className="mr-1.5" />
                  {getLanguageName(selectedLanguage)} ({selectedLanguage})
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>選擇語言</DialogTitle>
                </DialogHeader>
                <Select
                  value={selectedLanguage}
                  onValueChange={handleLanguageChange}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="選擇語言" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name} ({code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DialogContent>
            </Dialog>
          </div>

          <div>
            <SubmitKeywordResearchButton
              query={queryInput}
              region={selectedRegion}
              language={selectedLanguage}
              disabled={!queryInput.trim()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
