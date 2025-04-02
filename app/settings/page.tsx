'use client'; // Assuming SettingsTab requires client-side interaction

import SettingsTab from '@/components/settings-tool/SettingsTab';
import React from 'react';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-semibold mb-6">應用程式設定</h1>
      <SettingsTab />
    </div>
  );
}
