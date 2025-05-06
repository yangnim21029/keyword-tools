// components/common/GlobalLoadingOverlay.tsx
"use client";

// import { useQueryStore } from '@/providers/QueryProvider'; // Removed import
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid } from "lucide-react"; // 增加 LayoutGrid 圖標
import { useState } from "react";

export default function GlobalLoadingOverlay() {
  // const isLoading = useQueryStore((state) => state.state.isLoading); // Removed hook call
  // const loadingMessage = useQueryStore((state) => state.state.loadingMessage); // Removed hook call

  // Temporarily disable the overlay by keeping visible false
  const [visible, setVisible] = useState(false);
  const loadingMessage = "處理中..."; // Provide a default message if needed when re-enabled

  // Removed the useEffect that depended on isLoading
  // useEffect(() => {
  //   let timer: NodeJS.Timeout;
  //   if (isLoading) {
  //     timer = setTimeout(() => setVisible(true), 100);
  //   } else {
  //     setVisible(false);
  //   }
  //   return () => clearTimeout(timer);
  // }, [isLoading]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-lg backdrop-blur-md text-center max-w-md"
          >
            <div className="flex flex-col items-center">
              <LayoutGrid className="text-blue-500 dark:text-blue-400 h-9 w-9 mb-3" />

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                {loadingMessage || "處理中..."}
              </h3>

              <p className="text-gray-500 dark:text-gray-400 text-sm">
                資料處理可能需要幾秒鐘時間
              </p>

              {/* 简化进度条动画 */}
              <div className="w-32 mt-4 bg-gray-100 dark:bg-gray-800 rounded-full h-1 overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500 dark:bg-blue-400"
                  animate={{ width: ["0%", "50%", "75%", "100%", "100%"] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
