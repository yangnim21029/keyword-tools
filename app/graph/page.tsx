'use client';

import React, { useState, useTransition } from 'react';
import { 
    generateRevisionFromInputTextAndUrlGraph // Import the new single-step action
} from '@/app/actions/actions-ai-graph';
// Remove unused imports: getOnPageResultById, scrapeUrlAndGenerateGraph, generateRevisedArticleFromGraph
import { Loader2, AlertCircle } from 'lucide-react'; 

// --- UI Components (Keep simple or replace with your library) ---

const Button = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
        {...props}
        style={{
            padding: '10px 20px',
            margin: '10px 5px 10px 0',
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            border: '1px solid #ccc',
            borderRadius: '6px',
            backgroundColor: props.disabled ? '#e0e0e0' : '#4CAF50', // Green background
            color: props.disabled ? '#9e9e9e' : 'white',
            minWidth: '150px',
            fontSize: '1rem',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: props.disabled ? 0.7 : 1,
            ...props.style
        }}
        disabled={props.disabled}
    >
        {children}
    </button>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
     <input
        {...props}
        style={{
            width: '100%',
            padding: '10px',
            marginBottom: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxSizing: 'border-box',
            fontSize: '1rem'
        }}
     />
);

const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
        {...props}
        style={{
            width: '100%',
            minHeight: '200px', // Increased height
            padding: '10px',
            marginBottom: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxSizing: 'border-box', 
            fontSize: '1rem'
        }}
    />
);

const Card = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div style={{ border: '1px solid #eee', padding: '16px', margin: '16px 0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', background: '#fff' }}>
        <h2 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '8px' }}>{title}</h2>
        <div style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', maxHeight: '600px', overflowY: 'auto' }}> {/* Increased max height */} 
            {children}
        </div>
    </div>
);

const Alert = ({ variant = 'default', title, children }: { variant?: 'destructive' | 'default', title?: string, children: React.ReactNode }) => (
    <div style={{
        padding: '15px',
        margin: '15px 0', // Adjusted margin
        border: `1px solid ${variant === 'destructive' ? '#f5c6cb' : '#bee5eb'}`,
        borderRadius: '4px',
        color: variant === 'destructive' ? '#721c24' : '#0c5460',
        backgroundColor: variant === 'destructive' ? '#f8d7da' : '#d1ecf1'
    }}>
        {title && <h4 style={{ marginTop: 0, fontWeight: 'bold' }}>{title}</h4>}
        {children}
    </div>
);

// --- Page Component --- 

export default function GraphPage() {
    // State variables for simplified workflow
    const [inputText, setInputText] = useState('');
    const [targetUrl, setTargetUrl] = useState('');
    const [revisedArticle, setRevisedArticle] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Hook for transitions
    const [isPending, startTransition] = useTransition();

    // Handler for the single generation step
    const handleGenerate = () => {
        if (!inputText || !targetUrl || isLoading || isPending) return;

        // Basic URL check (can be done here or rely on server action validation)
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            setError('Please enter a valid target URL starting with http:// or https://');
            return;
        }

        startTransition(async () => {
            setIsLoading(true);
            setError(null);
            setRevisedArticle(null); // Clear previous result

            const result = await generateRevisionFromInputTextAndUrlGraph({ 
                inputText, 
                targetUrl 
            });

            if (result.success && result.revisedArticle) {
                setRevisedArticle(result.revisedArticle);
            } else {
                setError(result.error || 'An unknown error occurred during generation.');
            }

            setIsLoading(false);
        });
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto', background: '#f9f9f9' }}>
            <h1>Article Revision Tool (Simplified)</h1>

            <Card title="Your Input Text">
                <TextArea
                    placeholder="Paste the main article text you want to revise here..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isLoading || isPending}
                />
            </Card>

            <Card title="Target URL for Suggestions">
                 <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '10px' }}>
                     The content from this URL will be scraped to generate graph-based suggestions for revising your input text above.
                 </p>
                <Input
                    type="url"
                    placeholder="https://example.com/article-to-get-suggestions-from"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    disabled={isLoading || isPending}
                />
            </Card>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Button
                    onClick={handleGenerate}
                    disabled={!inputText || !targetUrl || isLoading || isPending}
                    style={{ backgroundColor: (isLoading || isPending) ? '#e0e0e0' : '#2196F3', color: 'white' }} // Blue button
                >
                    {(isLoading || isPending) ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                    ) : (
                        'Generate Revised Article'
                    )}
                </Button>
            </div>

            {error && (
                 <Alert variant="destructive" title="Error">
                     <AlertCircle className="mr-2 h-4 w-4" style={{ display: 'inline-block', verticalAlign: 'middle' }}/> {error}
                 </Alert>
            )}

            {revisedArticle !== null && (
                <Card title="Revised Article (AI Generated)">
                    {revisedArticle || 'Generation completed, but the result was empty.'}
                </Card>
            )}

        </div>
    );
}
