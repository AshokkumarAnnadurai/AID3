import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderClock,
  Mic,
  CheckSquare,
  Settings,
  WifiOff,
  BatteryCharging,
  Maximize2,
  Minimize2,
  Smartphone,
} from 'lucide-react';
import { useAppSelector } from '../store/hooks.ts';

export type ActiveTab = 'dashboard' | 'meetings' | 'record' | 'actions' | 'settings' | 'detail' | 'poc';

export interface MobileShellProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  children: React.ReactNode;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  activeTab,
  onTabChange,
  children,
}) => {
  const [currentTime, setCurrentTime] = useState('09:41');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const recorderStatus = useAppSelector((state) => state.recorder.status);
  const isRecording = recorderStatus === 'recording';

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hrs = now.getHours().toString().padStart(2, '0');
      const mins = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hrs}:${mins}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'meetings',
      label: 'Meetings',
      icon: <FolderClock className="w-5 h-5" />,
    },
    {
      id: 'record',
      label: 'Record',
      icon: (
        <div
          className={`w-11 h-11 -mt-5 rounded-full flex items-center justify-center shadow-lg transition-transform ${
            isRecording
              ? 'bg-red-500 text-white animate-pulse shadow-red-500/40 ring-4 ring-red-500/20'
              : 'bg-orange-500 text-white shadow-orange-500/40 hover:scale-105 active:scale-95'
          }`}
        >
          <Mic className="w-5 h-5" />
        </div>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      icon: <CheckSquare className="w-5 h-5" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start sm:py-6 sm:px-4 antialiased selection:bg-orange-500 selection:text-white">
      {/* Top control bar outside phone frame (for developer/tester controls) */}
      <header className="w-full max-w-md hidden sm:flex items-center justify-between px-3 py-2 mb-3 text-xs text-slate-400 bg-slate-900/90 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2">
          <Smartphone className="w-3.5 h-3.5 text-orange-400" />
          <span className="font-semibold text-slate-200">
            AID3 Native Engine
          </span>
          <button
            onClick={() => onTabChange('poc')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
              activeTab === 'poc'
                ? 'bg-orange-500 text-white'
                : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
            }`}
          >
            AI POC HARNESS
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
            <WifiOff className="w-3.5 h-3.5 text-orange-400" />
            <span>Offline</span>
          </div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 hover:text-slate-100 rounded hover:bg-slate-800 transition-colors"
            title="Toggle fullscreen mobile viewport"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Device Frame */}
      <div
        className={`w-full transition-all duration-300 relative bg-slate-950 flex flex-col overflow-hidden shadow-2xl ${
          isFullscreen
            ? 'h-screen max-w-none rounded-none border-none'
            : 'max-w-[430px] h-[92vh] max-h-[890px] rounded-[48px] border-[10px] border-slate-800 ring-1 ring-slate-700/50 shadow-black'
        }`}
      >
        {/* iOS Dynamic Island & Status Bar */}
        <div className="pt-3 pb-1 px-7 flex items-center justify-between text-xs select-none shrink-0 z-40 bg-slate-950/80 backdrop-blur-md">
          <span className="font-semibold text-sm tracking-tight text-slate-200">
            {currentTime}
          </span>

          {/* Dynamic Island pill */}
          <div className="flex items-center gap-2 px-3 py-1 bg-black rounded-full border border-slate-800/80">
            {isRecording ? (
              <span className="flex items-center gap-1.5 text-[10px] text-red-400 font-mono font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                REC
              </span>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Local AI Ready</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <WifiOff className="w-3.5 h-3.5 text-orange-400" />
            <BatteryCharging className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        {/* Screen Content Body */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none relative pb-20">
          {children}
        </main>

        {/* Bottom Navigation Tab Bar */}
        <nav className="absolute bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/90 px-2 py-2 flex items-center justify-around z-30">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const isRecButton = item.id === 'record';

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center relative py-1 px-3 min-w-[60px] transition-colors ${
                  isRecButton
                    ? 'text-slate-100'
                    : isActive
                    ? 'text-orange-500 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.icon}
                {!isRecButton && (
                  <span
                    className={`text-[11px] mt-1 tracking-tight ${
                      isActive ? 'font-semibold text-orange-400' : 'text-slate-400'
                    }`}
                  >
                    {item.label}
                  </span>
                )}
                {isActive && !isRecButton && (
                  <span className="absolute -top-1 w-5 h-0.5 bg-orange-500 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Home Indicator bar */}
        <div className="absolute bottom-1 inset-x-0 flex justify-center pointer-events-none z-40">
          <div className="w-32 h-1 bg-slate-600/60 rounded-full" />
        </div>
      </div>
    </div>
  );
};
