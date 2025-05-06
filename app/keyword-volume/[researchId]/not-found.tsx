import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center h-[50vh]">
        <div className="p-6 border border-destructive/50 bg-destructive/10 rounded-lg max-w-md">
          <h3 className="text-xl font-semibold text-destructive mb-2">
            找不到研究記錄
          </h3>
          <p className="text-destructive/90 mb-4">
            無法找到指定的研究記錄，可能已被刪除。
          </p>
          <Button asChild variant="outline">
            <Link href="/keyword-volume">返回關鍵字研究列表</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
