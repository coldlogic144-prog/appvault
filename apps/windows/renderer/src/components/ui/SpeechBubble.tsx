import React from 'react';

interface SpeechBubbleProps {
  children: React.ReactNode;
  direction?: 'left' | 'right';
  className?: string;
}

export default function SpeechBubble({ children, direction = 'left', className = '' }: SpeechBubbleProps) {
  return (
    <div className={`relative bg-panel text-text p-4 border-2 border-ink comic-shadow rounded-lg ${className}`}>
      {children}
      <div
        className={`absolute bottom-[-10px] w-0 h-0 border-t-[10px] border-t-ink ${
          direction === 'left' ? 'left-4 border-r-[10px] border-r-transparent' : 'right-4 border-l-[10px] border-l-transparent'
        }`}
      />
      <div
        className={`absolute bottom-[-6px] w-0 h-0 border-t-[8px] border-t-panel ${
          direction === 'left' ? 'left-[18px] border-r-[8px] border-r-transparent' : 'right-[18px] border-l-[8px] border-l-transparent'
        }`}
      />
    </div>
  );
}
