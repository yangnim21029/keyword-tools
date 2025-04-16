'use client';

import { useState } from 'react';
import { Prompt } from '../prompts';

interface TestInterfaceProps {
  prompt: Prompt;
  compact?: boolean;
}

export function TestInterface({ prompt, compact = false }: TestInterfaceProps) {
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [formattedPrompt, setFormattedPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const updateInputValue = (key: string, value: any) => {
    setInputValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const formatPrompt = () => {
    try {
      let formatted = prompt.text;
      Object.entries(inputValues).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          formatted = formatted.replace(`{${key}}`, value.join(', '));
        } else if (typeof value === 'string') {
          formatted = formatted.replace(`{${key}}`, value);
        }
      });
      setFormattedPrompt(formatted);
      return true;
    } catch (err) {
      setError('Error formatting prompt');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Format prompt for preview
    if (!formatPrompt()) return;

    try {
      setIsLoading(true);
      
      // Clean and prepare input data based on schema
      const input: Record<string, any> = {};
      
      // Process input based on schema properties
      const properties = prompt.inputSchema.properties;
      Object.entries(properties).forEach(([key, property]) => {
        if (inputValues[key] !== undefined) {
          if (property.type === 'array' && typeof inputValues[key] === 'string') {
            // Convert comma-separated string to array for array-type inputs
            input[key] = inputValues[key].split(',').map(item => item.trim());
          } else {
            input[key] = inputValues[key];
          }
        }
      });
      
      // Execute the action
      const result = await prompt.action(input);
      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const renderInputField = (key: string, property: any) => {
    if (property.type === 'string' && property.enum) {
      return (
        <select
          id={key}
          className={`w-full rounded-md border border-gray-300 ${compact ? 'text-xs p-1' : 'p-2'}`}
          value={inputValues[key] || (property.default || '')}
          onChange={(e) => updateInputValue(key, e.target.value)}
        >
          {property.enum.map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    } else if (property.type === 'string') {
      return (
        <input
          type="text"
          id={key}
          className={`w-full rounded-md border border-gray-300 ${compact ? 'text-xs p-1' : 'p-2'}`}
          value={inputValues[key] || ''}
          onChange={(e) => updateInputValue(key, e.target.value)}
          placeholder={property.description || ''}
        />
      );
    } else if (property.type === 'array') {
      return (
        <textarea
          id={key}
          className={`w-full rounded-md border border-gray-300 ${compact ? 'text-xs p-1' : 'p-2'}`}
          value={Array.isArray(inputValues[key]) ? inputValues[key].join(', ') : inputValues[key] || ''}
          onChange={(e) => updateInputValue(key, e.target.value)}
          placeholder={`Enter comma-separated ${property.description || 'values'}`}
          rows={compact ? 2 : 3}
        />
      );
    }
    
    return null;
  };

  return (
    <div className={`grid grid-cols-1 ${compact ? 'gap-3' : 'md:grid-cols-2 gap-6'}`}>
      <div>
        <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-medium mb-2`}>Test Input</h3>
        <form onSubmit={handleSubmit} className={`space-y-${compact ? '2' : '4'}`}>
          {Object.entries(prompt.inputSchema.properties).map(([key, property]) => (
            <div key={key} className={`space-y-${compact ? '0.5' : '1'}`}>
              <label htmlFor={key} className={`block ${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}>
                {key}{prompt.inputSchema.required?.includes(key) ? ' *' : ''}
              </label>
              <div className="mt-1">{renderInputField(key, property)}</div>
              {property.description && !compact && (
                <p className="text-xs text-gray-500">{property.description}</p>
              )}
            </div>
          ))}
          
          <button
            type="submit"
            disabled={isLoading}
            className={`${compact ? 'mt-2 px-2 py-1 text-xs' : 'mt-4 px-4 py-2 text-sm'} bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? 'Processing...' : 'Run Test'}
          </button>
        </form>

        {formattedPrompt && (
          <div className={`${compact ? 'mt-3' : 'mt-6'}`}>
            <h3 className={`${compact ? 'text-xs' : 'text-md'} font-medium mb-1`}>Formatted Prompt</h3>
            <pre className={`bg-gray-50 ${compact ? 'p-2 text-xs' : 'p-3 text-xs'} rounded-md overflow-x-auto whitespace-pre-wrap ${compact ? 'max-h-20' : ''}`}>
              {compact && formattedPrompt.length > 200 
                ? formattedPrompt.substring(0, 200) + '...' 
                : formattedPrompt}
            </pre>
          </div>
        )}
      </div>

      {!compact && (
        <div>
          <h3 className="text-lg font-medium mb-4">Result</h3>
          {isLoading ? (
            <div className="flex items-center justify-center h-48 bg-gray-50 rounded-md">
              <div className="animate-pulse text-gray-500">Processing...</div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          ) : result ? (
            <div className="bg-gray-50 p-4 rounded-md overflow-x-auto">
              <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 bg-gray-50 rounded-md text-gray-400">
              No results yet
            </div>
          )}
        </div>
      )}

      {compact && (result || error || isLoading) && (
        <div>
          <h3 className="text-sm font-medium mb-2">Result</h3>
          {isLoading ? (
            <div className="flex items-center justify-center h-16 bg-gray-50 rounded-md">
              <div className="animate-pulse text-gray-500 text-xs">Processing...</div>
            </div>
          ) : error ? (
            <div className="p-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs">
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          ) : result ? (
            <div className="bg-gray-50 p-2 rounded-md overflow-x-auto">
              <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
} 