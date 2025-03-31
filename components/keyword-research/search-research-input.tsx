'use client';

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useDebounce } from "use-debounce";

export default function SearchResearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const [debouncedCallback] = useDebounce(
    (value: string) => {
      const queryString = createQueryString('q', value);
      router.push(`${pathname}?${queryString}`);
    },
    300
  );

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
      <Input
        type="text"
        placeholder="搜索研究記錄..."
        defaultValue={searchParams.get('q') ?? ''}
        onChange={(e) => debouncedCallback(e.target.value)}
        className="pl-9"
      />
    </div>
  );
} 