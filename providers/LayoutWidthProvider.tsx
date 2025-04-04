'use client';

import { createContext, useContext } from 'react';

// Define the type for the context value
interface LayoutWidthContextType {
  isWideLayout: boolean;
}

// Create the context with a default value
export const LayoutWidthContext = createContext<LayoutWidthContextType>({ isWideLayout: true });

// Create the hook to consume the context
export const useLayoutWidth = () => useContext(LayoutWidthContext); 