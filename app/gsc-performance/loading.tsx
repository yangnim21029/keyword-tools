import React from "react";

// Skeleton Component for the /dev route
export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <div className="space-y-6 animate-pulse">
      {/* Skeleton Table Placeholder */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
      {/* Another Skeleton Table Placeholder */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
      {/* One more Skeleton Table Placeholder */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    </div>
  );
}
