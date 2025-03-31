'use server';

import { createKeywordResearch } from "@/app/actions/keyword-research";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search } from "lucide-react";
import { redirect } from "next/navigation";
import KeywordResearchSubmit from "./keyword-research-submit";

interface KeywordResearchFormProps {
  keyword?: string;
  region?: string;
  language?: string;
}

export default async function KeywordResearchForm({
  keyword = '',
  region = 'TW',
  language = 'zh_TW'
}: KeywordResearchFormProps) {
  async function handleSubmit(formData: FormData) {
    "use server";
    const researchId = await createKeywordResearch(formData);
    const path = '/keyword-research/' + researchId;
    redirect(path);
  }

  return (
    <div className="space-y-4">
      <form action={handleSubmit} className="flex gap-2">
        <input type="hidden" name="region" value={region} />
        <input type="hidden" name="language" value={language} />
        
        <div className="relative flex-1">
          <Input
            type="text"
            name="keyword"
            placeholder="輸入關鍵詞研究..."
            defaultValue={keyword}
            className="pl-9 pr-4 h-10 border-gray-200 dark:border-gray-800 shadow-sm focus:border-blue-300 dark:focus:border-blue-600 focus:ring-1 focus:ring-blue-300 dark:focus:ring-blue-600 rounded-full transition-colors"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <KeywordResearchSubmit />
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 dark:bg-gray-900 text-white shadow-lg">
              <p className="text-xs">開始關鍵詞研究</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </form>
    </div>
  );
}   