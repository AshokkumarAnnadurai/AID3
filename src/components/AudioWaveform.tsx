import React from 'react';

export interface AudioWaveformProps {
  isRecording: boolean;
  peakLevel?: number; // 0.0 to 1.0
  barCount?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording,
  peakLevel = 0,
  barCount = 28,
}) => {
  // Generate bar heights based on peakLevel and slight pseudo-random variation
  const bars = Array.from({ length: barCount }, (_, i) => {
    if (!isRecording) return 8; // static low bar when idle
    const wave = Math.sin((i / barCount) * Math.PI);
    const variance = ((i % 5) * 0.15) - 0.3;
    const height = Math.min(64, Math.max(8, (peakLevel * 56 * wave) + (variance * 20)));
    return Math.round(height);
  });

  return (
    <div className="flex items-center justify-center gap-1.5 h-20 px-4 py-2 bg-slate-950/60 rounded-2xl border border-slate-800/80 overflow-hidden">
      {bars.map((height, idx) => {
        const isCenter = Math.abs(idx - barCount / 2) < barCount / 4;
        return (
          <div
            key={idx}
            style={{ height: `${height}px` }}
            className={`w-1.5 rounded-full transition-all duration-75 ${
              isRecording
                ? isCenter
                  ? 'bg-orange-500 shadow-sm shadow-orange-500/50'
                  : 'bg-orange-400/70'
                : 'bg-slate-700/60'
            }`}
          />
        );
      })}
    </div>
  );
};
