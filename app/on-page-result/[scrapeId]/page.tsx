"use server";

import { getOnPageResultById, FirebaseOnPageResultObject } from '@/app/services/firebase/data-onpage-result';
import { notFound } from 'next/navigation';
import ScrapeResultDisplay from './scrape-result-client';
import { ClientSafeScrapeData } from './scrape-result-client';
import { NextPageProps } from '@/app/types';



// Helper function to convert server data (like Timestamps) to client-safe JSON
function makeScrapeDataClientSafe(serverData: FirebaseOnPageResultObject | null): ClientSafeScrapeData | null {
  if (!serverData) return null;
  try {
    // Convert Timestamps to ISO strings
    const clientData = {
      ...serverData,
      createdAt: serverData.createdAt?.toDate?.().toISOString() ?? null,
      updatedAt: serverData.updatedAt?.toDate?.().toISOString() ?? null,
    };
    // Use JSON stringify/parse for a deep clone, ensuring serializability
    return JSON.parse(JSON.stringify(clientData));
  } catch (error) {
    console.error('Error making scrape data client-safe:', error);
    return null; // Return null if conversion fails
  }
}

export default async function ScrapeResultPage({ params }: NextPageProps) {
  const scrapeId = (await params).scrapeId;

  if (!scrapeId) {
    console.warn('[Scrape Detail Page] Invalid or missing scrapeId:', scrapeId);
    notFound();
  }

  // Fetch initial data on the server
  const scrapeDataResult = await getOnPageResultById(scrapeId);

  // Prepare data for the client component
  const initialClientScrapeData = makeScrapeDataClientSafe(scrapeDataResult);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold mb-6">
        Scrape Result: {initialClientScrapeData?.title ? `"${initialClientScrapeData.title}"` : `ID ${scrapeId}`}
      </h1>

      {/* Render the client component with initial data */}
      <ScrapeResultDisplay
        scrapeData={initialClientScrapeData}
        scrapeId={scrapeId} // Pass the validated string ID
      />
    </div>
  );
}
