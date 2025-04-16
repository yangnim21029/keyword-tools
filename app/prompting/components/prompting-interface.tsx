'use client';

import { useState } from 'react';
import { Prompt } from '../prompts';
import { PromptCard } from './prompt-card';

interface PromptingInterfaceProps {
  prompts: Prompt[];
}

export function PromptingInterface({ prompts }: PromptingInterfaceProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [compactView, setCompactView] = useState(true);

  // Group prompts by category based on naming patterns
  const promptCategories: Record<string, Prompt[]> = {
    'SEO': prompts.filter(p => 
      p.id.includes('seo') || 
      p.id.includes('serp') || 
      p.id.includes('intent') || 
      p.id.includes('traffic') || 
      p.id.includes('content') || 
      p.id.includes('theme')
    ),
    'Keyword Analysis': prompts.filter(p => 
      p.id.includes('semantic') || 
      p.id.includes('cluster') || 
      p.id.includes('keyword')
    ),
    'User Research': prompts.filter(p => 
      p.id.includes('persona') || 
      p.id.includes('user')
    ),
    'All': prompts
  };

  // Filter prompts based on search term
  const filteredPrompts = searchTerm 
    ? prompts.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : activeCategory ? promptCategories[activeCategory] : prompts;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-3 sticky top-0 z-10 border border-gray-200">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div className="flex gap-2 flex-wrap items-center">
            {Object.keys(promptCategories).map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category === activeCategory ? null : category)}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                  activeCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category} ({promptCategories[category].length})
              </button>
            ))}
            
            <div className="ml-2 flex items-center">
              <label className="inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={compactView}
                  onChange={() => setCompactView(!compactView)}
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ms-2 text-xs font-medium text-gray-700">Compact</span>
              </label>
            </div>
          </div>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search prompts..."
              className="w-full md:w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${compactView ? 'md:grid-cols-2 lg:grid-cols-3' : ''} gap-3`}>
        {filteredPrompts.length > 0 ? (
          filteredPrompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} compact={compactView} />
          ))
        ) : (
          <div className="text-center py-10 text-gray-500 col-span-full">
            No prompts match your search criteria.
          </div>
        )}
      </div>
    </div>
  );
} 