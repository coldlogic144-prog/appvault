import React from 'react';

interface ComicPanelProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export default function ComicPanel({ children, title, className = '' }: ComicPanelProps) {
  return (
    <div className={`bg-panel border-4 border-ink comic-shadow relative p-4 ${className}`}>
      {title && (
        <div className="absolute -top-4 left-4 bg-accent-yellow border-2 border-ink px-3 py-1 font-bold text-ink uppercase tracking-wider text-sm comic-shadow z-10">
          {title}
        </div>
      )}
      <div className={title ? 'mt-2' : ''}>{children}</div>
    </div>
  );
}
