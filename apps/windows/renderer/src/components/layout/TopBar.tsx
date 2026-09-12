import { User, Bell } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="h-16 bg-panel border-b-4 border-ink flex items-center justify-between px-6 z-10">
      <div className="font-bold text-lg text-text-muted uppercase tracking-wider">
        {/* We can put breadcrumbs or active page title here later */}
        COMMUNICATIONS
      </div>
      
      <div className="flex items-center gap-4">
        <button className="p-2 text-text-muted hover:text-accent-yellow transition-colors relative">
          <Bell className="w-5 h-5" strokeWidth={2.5} />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-accent-red rounded-full border border-ink"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-4 border-l-2 border-border cursor-pointer hover:opacity-80">
          <div className="w-8 h-8 bg-accent-blue border-2 border-ink comic-shadow flex items-center justify-center text-ink rounded-full">
            <User className="w-4 h-4" strokeWidth={3} />
          </div>
          <span className="font-bold text-sm hidden sm:block">AGENT 42</span>
        </div>
      </div>
    </header>
  );
}
