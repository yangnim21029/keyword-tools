import type React from "react";

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 w-full overflow-auto p-4">
        {children}
      </div>
    </div>
  );
}

