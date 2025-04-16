import { Suspense } from 'react';
import { PromptingInterface } from './components/prompting-interface';
import { Prompts } from './prompts';

export default async function PromptingPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Prompting Management &amp; Testing</h1>
        <p className="mt-2 text-gray-600">
          Centralized repository for viewing, testing, and managing AI prompts
        </p>
      </header>
      
      <Suspense fallback={<div className="p-10 text-center">Loading prompt interfaces...</div>}>
        <PromptingInterface prompts={Prompts} />
      </Suspense>
      
      <footer className="mt-10 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>SEO Prompt Testing Interface</p>
      </footer>
    </div>
  );
}
