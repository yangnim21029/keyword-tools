'use client';

import { useFormStatus } from 'react-dom';
import { LoadingButton } from '@/components/ui/LoadingButton'; // Adjust path if needed

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <LoadingButton
      type="submit"
      isLoading={pending}
      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      loadingText="查詢中..." // Optional: text shown for accessibility when loading
    >
      查詢
    </LoadingButton>
  );
} 