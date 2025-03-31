'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsStore } from '@/store/settingsStore';
import { useEffect, useState } from 'react';
// Import types
import type { getRegions } from '@/app/actions';
import type { Language } from '@/providers/settings-provider';

interface RegionLanguageSelectorsProps {
  initialRegionsData: Awaited<ReturnType<typeof getRegions>>;
}

export default function RegionLanguageSelectors({ initialRegionsData }: RegionLanguageSelectorsProps) {
  const [isMounted, setIsMounted] = useState(false);
  const settingsState = useSettingsStore(store => store.state);
  const settingsActions = useSettingsStore(store => store.actions);
  const { region, language, languages, regionMap, languageMap } = settingsState;
  const { setRegion, setLanguage, setRegions, setLanguages, setRegionMap, setLanguageMap } = settingsActions;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Effect to initialize settings maps/lists from server props
  useEffect(() => {
    const apiRegions = initialRegionsData.regions;
    const apiLanguages = initialRegionsData.languages;
    if (apiRegions && typeof apiRegions === 'object') {
      const regionCodes = Object.values(apiRegions).filter(code => typeof code === 'string');
      setRegionMap(apiRegions);
      setRegions(regionCodes); // Still need to set the codes list
      if (apiLanguages && typeof apiLanguages === 'object') {
        setLanguageMap(apiLanguages);
        const languageCodes = Object.keys(apiLanguages);
        const languagesArrayMap: Record<string, string[]> = {};
        if (regionCodes.length > 0 && languageCodes.length > 0) {
           regionCodes.forEach(regionCode => { languagesArrayMap[regionCode] = languageCodes; });
           setLanguages(languagesArrayMap);
        } else { setLanguages({}); }
      } else { setLanguageMap({}); setLanguages({}); }
    } else { setRegionMap({}); setRegions([]); setLanguageMap({}); setLanguages({}); }
  }, [initialRegionsData, setRegionMap, setRegions, setLanguageMap, setLanguages]);

  const convertToLanguage = (lang: string): Language => {
    if (lang === 'zh-TW' || lang === 'en-US') { return lang as Language; }
    return 'zh-TW' as Language;
  };

  // Define the trigger class centrally
  const triggerClass = "flex items-center justify-between gap-1 h-7 px-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-gray-200 dark:focus:border-gray-700 focus-visible:outline-none";

  return (
    <div className="flex-shrink-0 text-sm text-gray-600 dark:text-gray-400 hidden md:flex items-center gap-2 whitespace-nowrap">
      <Select value={region} onValueChange={setRegion}>
        <SelectTrigger className={triggerClass}>
          <SelectValue placeholder="選擇地區">
            {region ? (isMounted && Object.keys(regionMap).length > 0 ? Object.keys(regionMap).find(key => regionMap[key] === region) || region : region) : '選擇地區'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="shadow-lg p-1.5">
          {Object.entries(regionMap).map(([name, code]) => (
            <SelectItem key={code} value={code} className="py-2">{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={language} onValueChange={(val) => setLanguage(convertToLanguage(val))}>
        <SelectTrigger className={triggerClass}>
          <SelectValue placeholder="選擇語言">
            {language ? (isMounted && Object.keys(languageMap).length > 0 ? languageMap[language] || language : language) : '選擇語言'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="shadow-lg p-1.5">
          {Array.isArray(languages[region]) && languages[region].map((langCode: string) => (
            <SelectItem key={langCode} value={langCode} className="py-2">{languageMap[langCode] || langCode}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
