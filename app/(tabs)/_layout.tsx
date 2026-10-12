import React from 'react';

// Expo Router Tabs layout structure
export default function TabLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="w-full h-full">
      {children}
    </div>
  );
}
