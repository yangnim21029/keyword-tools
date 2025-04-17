'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle } from 'lucide-react';
import { MEDIASITE_DATA } from '@/app/config/constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Define API endpoints
const STEP1_URL = '/api/writing/steps/1-analyze';
const STEP2_URL = '/api/writing/steps/2-plan';
const STEP3_URL = '/api/writing/steps/3-finalize';

export default function WritingPage() {
  const [keyword, setKeyword] = useState('');
  const [mediaSiteName, setMediaSiteName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [researchPrompt, setResearchPrompt] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [intermediateData, setIntermediateData] = useState<any>(null);

  const getStepMessage = () => {
    switch (currentStep) {
      case 1: return "Step 1: Analyzing SERP & Content...";
      case 2: return "Step 2: Planning Content Strategy...";
      case 3: return "Step 3: Finalizing Research Prompt...";
      default: return "Generating prompt, please wait...";
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResearchPrompt(null);
    setCurrentStep(0);
    setIntermediateData(null);

    if (!keyword || !mediaSiteName) {
      setError('Keyword and Media Site selection are required.');
      setIsLoading(false);
      return;
    }

    console.log(`Submitting: Keyword=${keyword}, MediaSiteName=${mediaSiteName}`);

    try {
      setCurrentStep(1);
      console.log(`[Step 1] Calling Analyze API: ${STEP1_URL}`);
      const step1Response = await fetch(STEP1_URL, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword, mediaSiteName }), 
      });

      console.log('[Step 1] API Response Status:', step1Response.status);
      if (!step1Response.ok) {
        const errorData = await step1Response.json().catch(() => step1Response.text());
        console.error('[Step 1] API Error:', errorData);
        throw new Error(`Step 1 Failed: ${errorData?.details || errorData?.error || JSON.stringify(errorData) || `HTTP error ${step1Response.status}`}`);
      }

      const step1Result = await step1Response.json();
      setIntermediateData(step1Result);
      console.log("[Step 1] Success. Received intermediate data.");

      setCurrentStep(2);
      console.log(`[Step 2] Calling Plan API: ${STEP2_URL}`);
      const step2Response = await fetch(STEP2_URL, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(step1Result),
      });

      console.log('[Step 2] API Response Status:', step2Response.status);
      if (!step2Response.ok) {
        const errorData = await step2Response.json().catch(() => step2Response.text());
        console.error('[Step 2] API Error:', errorData);
        throw new Error(`Step 2 Failed: ${errorData?.details || errorData?.error || JSON.stringify(errorData) || `HTTP error ${step2Response.status}`}`);
      }

      const step2Result = await step2Response.json();
      setIntermediateData(step2Result);
      console.log("[Step 2] Success. Received action plan data.");

      setCurrentStep(3);
      console.log(`[Step 3] Calling Finalize API: ${STEP3_URL}`);
      const step3Response = await fetch(STEP3_URL, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(step2Result),
      });

      console.log('[Step 3] API Response Status:', step3Response.status);
      if (!step3Response.ok) {
        const errorText = await step3Response.text();
        let errorJson;
        try { errorJson = JSON.parse(errorText); } catch (e) { /* ignore parse error */ }
        console.error('[Step 3] API Error:', errorJson || errorText);
        throw new Error(`Step 3 Failed: ${errorJson?.details || errorJson?.error || errorText || `HTTP error ${step3Response.status}`}`);
      }

      const finalPromptText = await step3Response.text();
      setResearchPrompt(finalPromptText);
      setCurrentStep(4);
      console.log("[Step 3] Success. Final Research Prompt Generated.");

    } catch (err) {
      console.error("Multi-step form submission error:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during the generation process.');
      setCurrentStep(0);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 py-12 max-w-3xl"> 
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Generate Research Prompt (Step-by-Step)</CardTitle>
          <CardDescription>
            Enter keyword and media site. Progress will be shown below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="keyword" className="font-medium">Keyword</Label>
              <Input 
                id="keyword" 
                value={keyword} 
                onChange={(e) => setKeyword(e.target.value)} 
                placeholder="e.g., 保濕面膜"
                required 
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mediaSite" className="font-medium">Media Site</Label>
              <Select 
                value={mediaSiteName} 
                onValueChange={(value) => setMediaSiteName(value)} 
                required
                disabled={isLoading}
              >
                <SelectTrigger id="mediaSite">
                  <SelectValue placeholder="Select a media site..." />
                </SelectTrigger>
                <SelectContent>
                  {MEDIASITE_DATA.map((site) => (
                    <SelectItem key={site.name} value={site.name}> 
                      {site.name} ({site.url}) 
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto h-10"> 
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? 'Generating...' : 'Generate Prompt'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(isLoading || error || researchPrompt || currentStep > 0 && currentStep < 4) && ( 
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Generation Progress</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading && currentStep > 0 && currentStep < 4 && (
              <div className="flex justify-center items-center p-6 text-muted-foreground">
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                <p className="text-lg">{getStepMessage()}</p>
              </div>
            )}
            {error && (
              <div className="flex items-start space-x-3 text-destructive bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-destructive/50">
                 <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                 <div>
                   <p className="font-semibold">Error occurred:</p>
                   <pre className="whitespace-pre-wrap font-sans text-sm mt-1">{error}</pre>
                 </div>
              </div>
            )}
            {!isLoading && researchPrompt && currentStep === 4 && (
              <div className="space-y-2">
                <Label className="font-medium">Generated Prompt:</Label>
                <Textarea 
                  readOnly 
                  value={researchPrompt} 
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
