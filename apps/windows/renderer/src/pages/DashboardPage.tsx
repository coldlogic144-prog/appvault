import ComicPanel from '../components/ui/ComicPanel';
import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 h-full">
      <h1 className="text-3xl font-black uppercase text-text tracking-wider flex items-center gap-3">
        <LayoutDashboard className="w-8 h-8 text-accent-yellow" />
        Command Center
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ComicPanel title="SYSTEM STATUS" className="min-h-[200px]">
          <p className="text-text-muted mt-2 font-bold uppercase">All systems operational.</p>
          <div className="mt-4 text-sm text-text-muted">
            Placeholder for system metrics and quick stats.
          </div>
        </ComicPanel>

        <ComicPanel title="RECENT ACTIVITY" className="min-h-[200px] lg:col-span-2">
          <p className="text-text-muted mt-2 font-bold uppercase">Activity Log</p>
          <div className="mt-4 text-sm text-text-muted">
            Placeholder for recent transfers and messages.
          </div>
        </ComicPanel>
      </div>
    </div>
  );
}
