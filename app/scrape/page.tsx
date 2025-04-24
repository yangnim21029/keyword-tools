"use client";

import React, { useState, useTransition } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateQuestionsFromReference } from './use-scrape-ai'; // Import the server action
import { Loader2 } from 'lucide-react';

export default function ScrapePage() {
    const [keyword, setKeyword] = useState<string>("");
    const [referenceContent, setReferenceContent] = useState<string>("");
    const [outline, setOutline] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition(); // Use useTransition for loading state

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setOutline(null);

        if (!keyword || !referenceContent) {
            setError("Please provide both a keyword and reference content.");
            return;
        }

        startTransition(async () => {
            try {
                const generatedOutline = await generateQuestionsFromReference(keyword, referenceContent);
                setOutline(generatedOutline);
            } catch (err) {
                console.error("Error generating outline:", err);
                setError(err instanceof Error ? err.message : "An unknown error occurred.");
            }
        });
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <h1 className="text-2xl font-bold mb-6">Generate Outline from Reference</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <Label htmlFor="keyword">Keyword</Label>
                    <Input
                        id="keyword"
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="Enter target keyword"
                        required
                        disabled={isPending}
                    />
                </div>
                <div>
                    <Label htmlFor="referenceContent">Reference Content</Label>
                    <Textarea
                        id="referenceContent"
                        value={referenceContent}
                        onChange={(e) => setReferenceContent(e.target.value)}
                        placeholder="Paste reference text content here..."
                        rows={15}
                        required
                        disabled={isPending}
                        className="min-h-[200px]"
                    />
                </div>
                <Button type="submit" disabled={isPending} className="w-full">
                    {isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                    ) : (
                        'Generate Outline'
                    )}
                </Button>
            </form>

            {error && (
                <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    <p className="font-bold">Error:</p>
                    <p>{error}</p>
                </div>
            )}

            {outline && (
                <div className="mt-6 p-4 bg-green-100 border border-green-400 rounded">
                    <h2 className="text-xl font-semibold mb-3">Generated Outline:</h2>
                    <pre className="whitespace-pre-wrap text-sm font-mono bg-white dark:bg-neutral-800 p-3 rounded border border-gray-200 dark:border-neutral-700">
                        {outline}
                    </pre>
                </div>
            )}
        </div>
    );
}
