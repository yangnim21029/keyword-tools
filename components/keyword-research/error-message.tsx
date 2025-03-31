'use client';

import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message?: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-2 text-red-500 text-sm mt-2">
      <AlertCircle className="h-4 w-4" />
      <p>{message}</p>
    </div>
  );
} 