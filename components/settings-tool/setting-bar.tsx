'use client';

import { useSettingsStore } from '@/store/settings-store';
import { useEffect, useState } from 'react';

export default function SettingBar() {
  // State to track client-side mounting
  const [isMounted, setIsMounted] = useState(false);

  // Use the hook to get reactive state
  const settingsState = useSettingsStore(store => store.state);

  // Effect to set mounted state on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Destructure for easier access
  const { region, language, regions, languages } = settingsState;

  // Get full names, fallback to code or loading indicator
  const regionName = regions[region] || region || '...';
  const languageName = languages[language] || language || '...';

  // Don't render until mounted on the client to avoid hydration mismatch
  if (!isMounted) {
    return null;
  }

  return (
    <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground border-r pr-2 mr-1">
      <span>{regionName}</span>
      <span>•</span>
      <span>{languageName}</span>
    </div>
  );
}
