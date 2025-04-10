import React from 'react';
import KeywordSearchForm from './components/keyword-search-form';

// Define a simple loading fallback component
const LoadingFallback = () => {
  return (
    <div className="flex items-center justify-center h-full pt-20">
      <p className="text-muted-foreground">Loading Keyword Tool...</p>
      {/* Optional: Add a spinner here */}
    </div>
  );
};

export default function KeywordToolPage() {
  return (
    <React.Suspense fallback={<LoadingFallback />}>
      <KeywordSearchForm />
    </React.Suspense>
  );
}