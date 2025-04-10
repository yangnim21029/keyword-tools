import { fetchKeywordResearchDetail } from "@/app/actions";
import KeywordResearchDetail from "./components/KeywordResearchDetail";
import { notFound } from "next/navigation";

export default async function KeywordResultPage({ params: paramsPromise }: { params: Promise<{ researchId: string }> }) {
  // Await the params Promise
  const { researchId } = await paramsPromise;

  // Fetch initial data on the server
  const researchDetail = await fetchKeywordResearchDetail(researchId);

  // If no research detail is found, show 404
  if (!researchDetail) {
    notFound();
  }

  return (
    <KeywordResearchDetail
      initialResearchDetail={researchDetail}
      researchId={researchId}
    />
  );
} 