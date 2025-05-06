import React from "react";
import { cn } from "@/lib/utils";

// Reusable DataTable Component
export function DataTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  renderRow,
  headerClassName,
}: {
  title: string;
  columns: { key: string; label: string }[];
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  headerClassName?: string;
}) {
  return (
    <>
      <div className="overflow-x-auto border border-gray-300 bg-white rounded-md shadow-md">
        <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span className="text-gray-700 text-xs font-mono tracking-wider uppercase">
              {title}
            </span>
          </div>
          <span className="text-gray-600 text-xs font-mono">
            GSC_ANALYZER.v1.0
          </span>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className={cn("bg-gray-100", headerClassName)}>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-2 text-left text-xs font-mono text-gray-700 uppercase tracking-wider"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.map((item, index) => renderRow(item, index))}
          </tbody>
        </table>
      </div>
      {/* Optional caption below the table */}
      {title && (
        <p className="my-2 px-1 text-xs text-gray-500 font-mono">
          <span className="text-gray-700">*</span> {title}
        </p>
      )}
    </>
  );
}
