'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Use Textarea for better display
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle } from 'lucide-react'; // Import AlertTriangle
import { MEDIASITE_DATA } from '../actions/writing-actions'; // Import website data for dropdown
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function WritingPage() {
  const [keyword, setKeyword] = useState('');
  const [mediaSite, setMediaSite] = useState(''); // Stores the selected URL
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [researchPrompt, setResearchPrompt] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResearchPrompt(null);

    // Find the selected site object to get region and language
    const selectedSite = MEDIASITE_DATA.find(site => site.url === mediaSite);

    if (!keyword || !mediaSite || !selectedSite) {
      setError('Keyword and a valid Media Site selection are required.');
      setIsLoading(false);
      return;
    }

    // Extract region and language from the selected site
    const { region, language } = selectedSite;

    console.log(`Submitting: Keyword=${keyword}, MediaSite=${mediaSite}, Region=${region}, Language=${language} (Derived from Media Site)`);

    try {
      const response = await fetch('/api/get-research-prompt', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Use derived region and language
        body: JSON.stringify({ keyword, mediaSite, region, language }), 
      });

      console.log('API Response Status:', response.status);

      if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
            console.error('API Error JSON:', errorData);
        } catch (e) {
            errorData = await response.text(); 
            console.error('API Error Text:', errorData);
        }
        throw new Error(errorData?.details || errorData?.error || errorData || `HTTP error ${response.status}`);
      }

      const resultText = await response.text();
      console.log('API Success Result Length:', resultText.length);
      setResearchPrompt(resultText);

    } catch (err) {
      console.error("Form submission error:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching the prompt.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Increased vertical padding
    <div className="container mx-auto p-4 py-12 max-w-3xl"> 
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Generate Research Prompt</CardTitle>
          <CardDescription>
            Enter a keyword and select a media site. The region and language will be set automatically based on the site.
          </CardDescription>
        </CardHeader>
        <CardContent>
           {/* Increased form spacing */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2"> {/* Consistent spacing for label+input */}
              <Label htmlFor="keyword" className="font-medium">Keyword</Label> {/* Medium weight label */}
              <Input 
                id="keyword" 
                value={keyword} 
                onChange={(e) => setKeyword(e.target.value)} 
                placeholder="e.g., 保濕面膜"
                required 
              />
            </div>
            <div className="space-y-2"> {/* Consistent spacing for label+select */}
              <Label htmlFor="mediaSite" className="font-medium">Media Site</Label> {/* Medium weight label */}
              <Select 
                value={mediaSite} 
                onValueChange={(value) => setMediaSite(value)} // Just set the URL
                required
              >
                <SelectTrigger id="mediaSite">
                  <SelectValue placeholder="Select a media site..." />
                </SelectTrigger>
                <SelectContent>
                  {MEDIASITE_DATA.map((site) => (
                    <SelectItem key={site.url} value={site.url}>
                      {/* Display URL instead of title */}
                      {site.url} 
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Standard button height */}
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto h-10"> 
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? 'Generating...' : 'Generate Prompt'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(isLoading || error || researchPrompt) && (
        <Card className="mt-8"> {/* Increased margin-top */}
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          {/* Added padding to result content */}
          <CardContent className="p-6"> 
            {isLoading && (
              <div className="flex justify-center items-center p-6 text-muted-foreground"> {/* Subtle text color */}
                <Loader2 className="mr-3 h-6 w-6 animate-spin" /> {/* Slightly larger spinner */}
                <p className="text-lg">Generating prompt, please wait...</p> {/* Larger text */}
              </div>
            )}
            {error && (
               // Improved error display with icon
              <div className="flex items-start space-x-3 text-destructive bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-destructive/50">
                 <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                 <div>
                   <p className="font-semibold">Error occurred:</p>
                   <pre className="whitespace-pre-wrap font-sans text-sm mt-1">{error}</pre>
                 </div>
              </div>
            )}
            {researchPrompt && (
              <div className="space-y-2"> {/* Space between label and textarea */}
                <Label className="font-medium">Generated Prompt:</Label> {/* Medium weight label */}
                <Textarea 
                  readOnly 
                  value={researchPrompt} 
                   // Added subtle background, adjusted height, text size
                  className="mt-1 h-[400px] font-mono text-xs bg-muted/50 border rounded-md p-3" 
                  placeholder="Generated prompt will appear here..."
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
