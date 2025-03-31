'use client';

import { deleteKeywordResearchRecord } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface DeleteResearchButtonProps {
  id: string;
}

export default function DeleteResearchButton({ id }: DeleteResearchButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isDeleting) return;
    
    if (!confirm('確定要刪除這個研究記錄嗎？')) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteKeywordResearchRecord(id);
      if (!result.success) {
        throw new Error(result.error || '刪除失敗');
      }
      toast.success('研究記錄已刪除');
      router.refresh();
    } catch (error) {
      console.error('刪除研究記錄失敗:', error);
      toast.error('刪除研究記錄失敗');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={handleDelete}
      disabled={isDeleting}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
} 