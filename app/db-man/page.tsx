'use client';

import React from 'react';
import { removeDuplicateKeywordResearch } from '../actions/keyword-research-action';
import { Button } from '@/components/ui/button'; // Assuming Shadcn UI Button

// Example component to trigger the deduplication
// Note: This is a client component to handle the button click and state

function RemoveDuplicatesButton() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const handleRemoveDuplicates = async () => {
    setIsLoading(true);
    setMessage('');
    try {
      const result = await removeDuplicateKeywordResearch();
      if (result.success) {
        setMessage(`Successfully removed ${result.removedCount ?? 0} duplicate entries.`);
      } else {
        setMessage(`Error: ${result.error || 'Failed to remove duplicates.'}`);
      }
    } catch (error) {
      console.error('Error removing duplicates:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={handleRemoveDuplicates} disabled={isLoading}>
        {isLoading ? 'Removing Duplicates...' : 'Remove Duplicate Research Entries'}
      </Button>
      {message && (
        <p className={`text-sm ${
          message.startsWith('Error') ? 'text-red-600' : 'text-green-600'
        }`}>
          {message}
        </p>
      )}
    </div>
  );
}

// The main page component (Server Component by default in App Router)
// It renders the client component button
export default function DbManPage() {
  // You could add logic here to display research entries, add new ones, etc.
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Database Management</h1>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Cleanup</h2>
        <p className="text-muted-foreground mb-3">
          Remove duplicate keyword research entries based on query, language, and region.
          The NEWEST entry for each combination will be kept.
        </p>
        <RemoveDuplicatesButton />
      </section>

      {/* Add other sections for adding entries, viewing list, etc. */}
    </div>
  );
} 