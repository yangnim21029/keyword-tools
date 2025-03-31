import KeywordResearchForm from '@/components/keyword-research/keyword-research-form';
import { LANGUAGES, REGIONS } from '../config/constants';

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const regionsAndLanguagesData = {
    regions: REGIONS,
    languages: LANGUAGES,
  };

  return (
    <div className="w-full h-full overflow-auto">
      <KeywordResearchForm />
      {/* <HeaderClient initialRegionsData={regionsAndLanguagesData} /> */}
      <main className="p-4">
        {children}
      </main>
    </div>
  );
} 