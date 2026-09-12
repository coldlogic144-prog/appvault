import React from 'react';

interface ComicInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function ComicInput({ label, error, className = '', ...props }: ComicInputProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="font-bold text-text-muted text-sm uppercase">{label}</label>}
      <input
        className={`bg-ink border-2 border-border text-text px-3 py-2 outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors ${
          error ? 'border-accent-red' : ''
        }`}
        {...props}
      />
      {error && <span className="text-accent-red text-xs font-bold uppercase">{error}</span>}
    </div>
  );
}
