'use client';

import { useState } from 'react';
import { Prompt } from '../prompts';
import { TestInterface } from './test-interface';

interface PromptCardProps {
  prompt: Prompt;
  compact?: boolean;
}

export function PromptCard({ prompt, compact = false }: PromptCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showScreenshotMode, setShowScreenshotMode] = useState(false);

  return (
    <div className={`border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden ${showScreenshotMode ? 'print:shadow-none print:border-none' : ''}`}>
      <div className={`${compact ? 'p-3' : 'p-6'} ${showScreenshotMode ? 'pb-0' : ''}`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className={`${compact ? 'text-lg' : 'text-2xl'} font-bold text-gray-900 line-clamp-1`}>{prompt.name}</h2>
            <p className={`${compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'} text-gray-500 line-clamp-2`}>{prompt.description}</p>
          </div>
          <div className="flex gap-1 flex-wrap justify-end ml-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`${compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'} bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors`}
            >
              {isExpanded ? 'Hide' : 'View'}
            </button>
            <button
              onClick={() => setShowTest(!showTest)}
              className={`${compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'} bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors`}
            >
              {showTest ? 'Hide' : 'Test'}
            </button>
            <button
              onClick={() => setShowScreenshotMode(!showScreenshotMode)}
              className={`${compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'} rounded-md transition-colors ${
                showScreenshotMode 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {compact ? (showScreenshotMode ? 'Exit' : 'Shot') : (showScreenshotMode ? 'Exit Screenshot Mode' : 'Screenshot Mode')}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className={`${compact ? 'mt-2' : 'mt-4'}`}>
            <div className="flex justify-between items-center">
              <h3 className={`${compact ? 'text-sm' : 'text-md'} font-semibold`}>Prompt Template</h3>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(prompt.text);
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Copy
              </button>
            </div>
            <pre className={`${compact ? 'mt-1 p-2 text-xs' : 'mt-2 p-4 text-sm'} bg-gray-50 rounded-md overflow-x-auto whitespace-pre-wrap border border-gray-200 font-mono max-h-60`}>
              {prompt.text}
            </pre>
          </div>
        )}

        {showScreenshotMode && (
          <div className={`${compact ? 'mt-3 pt-2' : 'mt-6 pt-4'} border-t border-gray-200`}>
            <div className="flex justify-between items-center mb-2">
              <h3 className={`${compact ? 'text-sm' : 'text-md'} font-semibold`}>Screenshot View</h3>
              <div className="text-xs text-gray-500">
                ID: {prompt.id}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 print:border-none">
              <h2 className={`${compact ? 'text-lg' : 'text-2xl'} font-bold mb-2`}>{prompt.name}</h2>
              <div className="mb-3">
                <p className="text-gray-700 text-sm">{prompt.description}</p>
              </div>
              <div className="space-y-2">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500">Input Schema</h4>
                  <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {Object.entries(prompt.inputSchema.properties).map(([key, property]: [string, any]) => (
                      <div key={key} className="bg-white p-1.5 rounded border border-gray-200 flex flex-col">
                        <div className="flex items-start">
                          <span className="text-xs font-mono bg-blue-100 text-blue-700 px-1 py-0.5 rounded mr-1">
                            {key}
                          </span>
                          <span className="text-xs text-gray-500 ml-auto">
                            {property.type === 'array' ? 'array' : property.type}
                          </span>
                        </div>
                        {property.description && (
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{property.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500">Prompt Template</h4>
                  <pre className="mt-1 bg-white p-2 rounded border border-gray-200 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-20">
                    {prompt.text.length > 300 
                      ? prompt.text.substring(0, 300) + '...' 
                      : prompt.text}
                  </pre>
                </div>
              </div>
            </div>
            <div className="text-xs text-center text-gray-400 mt-1">
              Screenshot mode - UI elements hidden for clean capture
            </div>
          </div>
        )}

        {showTest && !showScreenshotMode && (
          <div className={`${compact ? 'mt-3 pt-2' : 'mt-6 pt-4'} border-t border-gray-200`}>
            <TestInterface prompt={prompt} compact={compact} />
          </div>
        )}
      </div>
    </div>
  );
} 