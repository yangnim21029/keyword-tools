"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export default function SearchButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "px-4 py-2 bg-gray-700 text-white rounded-md font-mono text-sm",
        "hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2",
        "transition-all duration-200 ease-in-out",
        "disabled:opacity-70 disabled:cursor-not-allowed",
        "flex items-center gap-2 min-w-[160px] justify-center",
      )}
    >
      {pending ? (
        <>
          <LoadingSpinner />
          <span>ANALYZING...</span>
        </>
      ) : (
        <>
          <CommandIcon />
          <span>$ RUN_ANALYSIS</span>
        </>
      )}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CommandIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 17l6-6-6-6" />
      <path d="M12 19h8" />
    </svg>
  );
}
