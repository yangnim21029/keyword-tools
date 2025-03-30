// components/common/GlobalLoadingOverlay.tsx
'use client';

import { useSearchStore } from '@/store/searchStore';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react'; // 增加 LayoutGrid 圖標
import { useEffect, useState } from 'react';

export default function GlobalLoadingOverlay() {
  const isLoading = useSearchStore((state) => state.state.isLoading);
  const loadingMessage = useSearchStore((state) => state.state.loadingMessage);
  const [visible, setVisible] = useState(false);
  
  // 添加延時效果，避免閃爍
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setTimeout(() => setVisible(true), 100);
    } else {
      setVisible(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-8 text-center shadow-md bg-white/90 dark:bg-gray-800/90 backdrop-blur-md max-w-md"
          >
            <div className="flex flex-col items-center">
              <LayoutGrid className="text-blue-500 dark:text-blue-400 h-9 w-9 mb-4" />
              
              <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
                {loadingMessage || '處理中...'}
              </h3>
              
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                資料處理可能需要幾秒鐘時間，請稍候
              </p>
              
              {/* 保留進度條動畫 */}
              <div className="w-full mt-6 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <motion.div 
                  className="h-full bg-blue-500 dark:bg-blue-400"
                  animate={{ width: ['0%', '50%', '75%', '100%', '100%'] }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity, 
                    ease: "easeInOut"
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