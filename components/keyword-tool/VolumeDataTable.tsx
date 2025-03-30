'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KeywordVolumeItem } from "@/lib/schemas";
import { SortField, SortState } from "@/types/keywordTool.d";
import { SortAsc, SortDesc } from "lucide-react";

interface VolumeDataTableProps {
  volumeData: KeywordVolumeItem[]; // Expects sorted data
  sortState: SortState;
  onSort: (field: SortField) => void;
}

// Helper to render sort icons
const SortIcon = ({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) => {
  if (!active) return null;
  return direction === 'asc' ? <SortAsc className="h-3 w-3 ml-1" /> : <SortDesc className="h-3 w-3 ml-1" />;
};

// Helper for Table Head styling and click handling
const SortableTableHead = ({
  field,
  label,
  sortState,
  onSort,
  className = "",
  align = "left"
}: {
  field: SortField;
  label: string;
  sortState: SortState;
  onSort: (field: SortField) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}) => {
  const isActive = sortState.field === field;
  const alignmentClass = `text-${align}`;
  return (
    <TableHead
      className={`text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider py-3 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${alignmentClass} ${className}`}
      onClick={() => onSort(field)}
      aria-sort={isActive ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <div className={`flex items-center ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'} gap-1`}>
        {label}
        <SortIcon active={isActive} direction={sortState.direction} />
      </div>
    </TableHead>
  );
};


export function VolumeDataTable({ volumeData, sortState, onSort }: VolumeDataTableProps) {
  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm">
      <Table className="w-full min-w-[600px]">
        <TableHeader>
          <TableRow className="border-b border-gray-200 dark:border-gray-800 hover:bg-transparent bg-gray-50/50 dark:bg-gray-900/20">
            <SortableTableHead field="text" label="關鍵詞" sortState={sortState} onSort={onSort} />
            <SortableTableHead field="searchVolume" label="月搜尋量" sortState={sortState} onSort={onSort} align="center" />
            <SortableTableHead field="competition" label="競爭程度" sortState={sortState} onSort={onSort} align="center" />
            <SortableTableHead field="cpc" label="平均CPC" sortState={sortState} onSort={onSort} align="center" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {volumeData.map((item, index) => (
            <TableRow
              key={item.text + index}
              className={`hover:bg-blue-50/30 dark:hover:bg-gray-800/20 transition-colors ${index !== volumeData.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/50' : ''}`}
            >
              <TableCell className="py-3 px-4 text-sm text-gray-800 dark:text-gray-200 font-medium">{item.text}</TableCell>
              <TableCell className="py-3 px-4 text-center">
                {item.searchVolume !== undefined && item.searchVolume !== null ? (
                  <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">{item.searchVolume.toLocaleString()}</span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                )}
              </TableCell>
              <TableCell className="py-3 px-4 text-center">
                {item.competition ? (
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    item.competition.toUpperCase() === 'LOW' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30' : 
                    item.competition.toUpperCase() === 'MEDIUM' ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-300 border border-yellow-100 dark:border-yellow-900/30' : 
                    item.competition.toUpperCase() === 'HIGH' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300 border border-red-100 dark:border-red-900/30' : 
                    'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-300 border border-gray-200 dark:border-gray-800'}`
                  }>
                    {item.competition}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                )}
              </TableCell>
              <TableCell className="py-3 px-4 text-center">
                {item.cpc ? (
                  <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">${item.cpc.toFixed(2)}</span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* Optional: Add empty state within the table if data is empty */}
      {volumeData.length === 0 && (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/10 rounded-b-lg">
          沒有可顯示的搜索量數據。
        </div>
      )}
    </div>
  );
} 