'use client';

import { submitCreateScrape } from '@/app/actions/actions-onpage-result'; // Import the server action
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useTransition } from 'react';

export default function CreateNewScrapeForm() {
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!url) {
      setError('Please enter a URL.');
      return;
    }

    // Basic check for http/https
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitCreateScrape({ url });
        if (result.success && result.id) {
          // Redirect to the newly created scrape result page
          router.push(`/on-page-result/${result.id}`);
        } else {
          setError(
            result.error || 'An unknown error occurred during scraping.'
          );
        }
      } catch (err) {
        console.error('Error submitting scrape request:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'An unknown network or server error occurred.'
        );
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-4 border rounded-lg bg-card shadow-sm"
    >
      <h3 className="text-lg font-semibold">Scrape New URL</h3>
      <div className="space-y-2">
        <Label htmlFor="url">Page URL</Label>
        <Input
          id="url"
          type="url" // Use type url for better semantics/validation
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          required
          disabled={isPending}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scraping...
          </>
        ) : (
          'Scrape and Analyze'
        )}
      </Button>
    </form>
  );
}
