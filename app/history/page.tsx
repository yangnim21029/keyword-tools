import KeywordResearchList from "./components/KeywordResearchList";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { fetchKeywordResearchList } from "@/app/actions";

export default async function HistoryPage() {
  // Fetch initial data on the server
  const { data: initialResearches, error } = await fetchKeywordResearchList();
  
  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b">
        <h1 className="text-xl font-semibold">Keyword Research History</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-2">
          <KeywordResearchList 
            hideRefreshButton={false} 
            initialResearches={initialResearches}
          />
        </ScrollArea>
      </div>
    </div>
  );
} 