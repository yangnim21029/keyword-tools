import { fetchKeywordResearchDetail, fetchKeywordResearchList } from "@/app/actions";
import KeywordResearchDetail from "./components/KeywordResearchDetail";
import { notFound } from "next/navigation";

// Function to generate static paths at build time
export async function generateStaticParams() {
  // Fetch all research items (consider fetching only IDs if performance becomes an issue)
  const { data: researches } = await fetchKeywordResearchList(undefined, undefined, 1000); // Fetch a large number or implement pagination if needed

  // Map the data to the format required by generateStaticParams
  return researches.map((research) => ({
    researchId: research.id,
  }));
}

export default async function KeywordResultPage({ params: paramsPromise }: { params: Promise<{ researchId: string }> }) {
  // Await the params Promise again
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