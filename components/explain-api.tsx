'use client';

import { useState } from 'react';

interface ExplainApiProps {
  apiUrl: string;
  description: string;
  curlCommand: string;
  defaultPostBody?: object; // Example/default body for POST
  method?: 'POST' | 'GET'; // Default to POST
}

export function ExplainApi({ 
  apiUrl, 
  description, 
  curlCommand, 
  defaultPostBody = { keyword: 'example keyword', mediaSiteName: 'exampleSite' }, // Provide a default
  method = 'POST' 
}: ExplainApiProps) {
  // Initialize state with default body, handling potential stringification errors
  let initialBody = '';
  try {
    initialBody = JSON.stringify(defaultPostBody, null, 2);
  } catch (e) {
    console.error("Error stringifying defaultPostBody:", e);
    initialBody = '{ "error": "Invalid default body provided to component" }';
  }
  const [postBody, setPostBody] = useState<string>(initialBody);
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null); // State for timing

  const handleCallApi = async () => {
    if (method !== 'POST') {
      setError('Only POST method is supported by this button for now.');
      return;
    }
    
    let parsedBody;
    try {
        parsedBody = JSON.parse(postBody);
    } catch (e) {
        setError('Invalid JSON in request body textarea.');
        return;
    }

    setIsLoading(true);
    setResponse(null);
    setError(null);
    setExecutionTime(null); // Reset timer display

    const startTime = performance.now(); // Record start time

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: postBody, // Send the raw string from the textarea
      });

      // Check content type to decide how to process response
      const contentType = res.headers.get("content-type");
      let responseData;

      if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await res.json();
          responseData = JSON.stringify(data, null, 2); // Pretty print JSON
      } else {
          responseData = await res.text(); // Treat as plain text
      }

      if (!res.ok) {
        // Try to parse error from JSON, fallback to status text
        let errorMessage = `Request failed with status ${res.status}`;
        try {
            const errorJson = JSON.parse(responseData); // Use already fetched responseData
            errorMessage = errorJson.error || errorJson.details || errorMessage;
        } catch (parseError) { /* Ignore if response wasn't JSON */ }
        throw new Error(errorMessage);
      }

      setResponse(responseData);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
      setResponse(null);
    } finally {
      const endTime = performance.now(); // Record end time
      setExecutionTime(endTime - startTime); // Calculate and set duration
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>{apiUrl} <span style={styles.methodTag}>[{method}]</span></h3>
      <p style={styles.description}>{description}</p>
      <h4 style={styles.subHeading}>Example Curl:</h4>
      <pre style={styles.pre}><code>{curlCommand}</code></pre>
      
      {method === 'POST' && (
        <div style={styles.interactiveSection}>
          <h4 style={styles.subHeading}>Test API Call:</h4>
          <label htmlFor={`body-${apiUrl}`} style={styles.label}>Request Body (JSON):</label>
          <textarea
            id={`body-${apiUrl}`}
            value={postBody}
            onChange={(e) => setPostBody(e.target.value)}
            placeholder='Enter JSON body here...'
            rows={6}
            style={styles.textarea}
            disabled={isLoading}
          />
          <button 
            onClick={handleCallApi} 
            disabled={isLoading} 
            style={isLoading ? styles.buttonDisabled : styles.button}
          >
            {isLoading ? 'Sending...' : `Send POST Request`}
          </button>
        </div>
      )}

      {executionTime !== null && (
        <p style={styles.timingText}>
          Request completed in: {(executionTime / 1000).toFixed(2)} seconds
        </p>
      )}

      {error && (
        <>
          <h4 style={{ ...styles.subHeading, color: 'red' }}>Error:</h4>
          <pre style={{ ...styles.pre, borderColor: 'red', color: 'red' }}>{error}</pre>
        </>
      )}

      {response && (
        <>
          <h4 style={styles.subHeading}>Response:</h4>
          <pre style={styles.pre}>{response}</pre>
        </>
      )}
    </div>
  );
}

// Simpler styling
const styles = {
  container: {
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    padding: '15px',
    marginBottom: '25px',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    backgroundColor: '#fafafa'
  },
  heading: {
    marginTop: '0',
    marginBottom: '10px',
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#333',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  methodTag: {
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: '#555',
    backgroundColor: '#eee',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  description: {
    fontSize: '0.95rem',
    color: '#444',
    marginBottom: '15px'
  },
  subHeading: {
    marginTop: '15px',
    marginBottom: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#555',
  },
  pre: {
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '10px 15px',
    overflowX: 'auto' as const,
    fontSize: '0.85rem',
    whiteSpace: 'pre-wrap' as const, 
    wordWrap: 'break-word' as const,
    color: '#333'
  },
  interactiveSection: {
    marginTop: '15px',
    borderTop: '1px solid #eee',
    paddingTop: '15px'
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 500,
    fontSize: '0.9rem'
  },
  textarea: {
    width: 'calc(100% - 22px)', // Adjust for padding/border
    padding: '10px',
    marginBottom: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    minHeight: '80px',
    transition: 'border-color 0.2s ease',
    selectors: {
      '&:hover': {
        borderColor: '#a0a0a0',
      },
      '&:focus': {
        borderColor: '#007bff',
        boxShadow: '0 0 0 1px #007bff40',
        outline: 'none',
      }
    }
  },
  button: {
    padding: '8px 14px',
    fontSize: '0.9rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  },
  buttonDisabled: {
    padding: '8px 14px',
    fontSize: '0.9rem',
    backgroundColor: '#cccccc',
    color: '#666666',
    border: 'none',
    borderRadius: '4px',
    cursor: 'not-allowed',
  },
  timingText: {
    marginTop: '15px',
    fontSize: '0.85rem',
    color: '#666',
    fontStyle: 'italic',
  }
}; 