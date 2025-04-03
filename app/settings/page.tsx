"use client"

import SettingsTab from "@/components/settings-tool/SettingsTab"
import { ToolHeader } from "@/components/tools/ToolHeader"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <>
      <ToolHeader
        title="應用程式設定"
        description="配置全局設置，包括地區、語言和搜索選項。"
        activeTool="settings"
        icon={<Settings className="h-5 w-5 text-gray-500" />}
      />

      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm">
        <SettingsTab />
      </div>
    </>
  )
}

