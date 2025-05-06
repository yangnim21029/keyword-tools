import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
      <div className="flex items-center space-x-2">
        <FileText className="h-8 w-8 text-blue-500" />
        <h1 className="text-4xl font-bold">404</h1>
      </div>
      <h2 className="text-2xl font-semibold">頁面未找到</h2>
      <p className="text-muted-foreground text-center max-w-md">
        抱歉，您訪問的頁面不存在。請檢查 URL 是否正確，或返回首頁。
      </p>
      <Button asChild>
        <Link href="/">返回首頁</Link>
      </Button>
    </div>
  );
}
