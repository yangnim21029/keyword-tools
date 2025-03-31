'use client';

import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useFormStatus } from "react-dom";

export default function KeywordResearchSubmit() {
  const { pending } = useFormStatus();

  return (
    <Button 
      type="submit"
      className="h-10 bg-blue-500 hover:bg-blue-600 text-white px-4 rounded-full transition-colors shadow-sm"
      disabled={pending}
    >
      {pending ? (
        <>
          <LoadingSpinner className="mr-2 h-4 w-4" />
          處理中...
        </>
      ) : (
        "開始研究"
      )}
    </Button>
  );
} 