interface LogoProps {
  className?: string;
}

export default function Logo({ className = '' }: LogoProps) {
  return (
    <div className={`font-black text-2xl tracking-tighter uppercase flex items-center ${className}`}>
      <span className="text-accent-red comic-shadow-sm px-1 bg-ink border-2 border-ink transform -rotate-2">COMIC</span>
      <span className="text-accent-blue comic-shadow-sm px-1 bg-ink border-2 border-ink transform rotate-2 -ml-1">LINK</span>
    </div>
  );
}
