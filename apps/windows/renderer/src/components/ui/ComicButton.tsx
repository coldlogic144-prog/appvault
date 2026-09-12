import React from 'react';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ComicButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export default function ComicButton({
  children,
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  disabled,
  ...props
}: ComicButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-bold uppercase transition-transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none border-2 border-ink comic-shadow';
  
  const variants: Record<Variant, string> = {
    primary: 'bg-accent-red text-white hover:bg-red-600',
    secondary: 'bg-accent-blue text-white hover:bg-blue-600',
    accent: 'bg-accent-yellow text-ink hover:bg-yellow-500',
    ghost: 'bg-transparent border-2 border-border text-text hover:bg-panel comic-shadow-none hover:comic-shadow',
  };

  const sizes: Record<Size, string> = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'WAIT...' : children}
    </button>
  );
}
