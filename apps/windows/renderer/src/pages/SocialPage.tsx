import ComicPanel from '../components/ui/ComicPanel';
import { Globe } from 'lucide-react';

export default function SocialPage() {
  return (
    <div className="flex flex-col gap-6 h-full">
      <h1 className="text-3xl font-black uppercase text-text tracking-wider flex items-center gap-3">
        <Globe className="w-8 h-8 text-accent-yellow" />
        Global Intel
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full pb-4">
        <div className="md:col-span-2 flex flex-col gap-6">
          <ComicPanel title="LATEST DISPATCHES">
            <div className="py-8 text-center text-text-muted font-bold uppercase">
              No recent updates from network.
            </div>
          </ComicPanel>
        </div>
        
        <div className="flex flex-col gap-6">
          <ComicPanel title="AGENTS ONLINE">
            <div className="py-4 text-center text-text-muted font-bold uppercase text-sm">
              Discovering agents...
            </div>
          </ComicPanel>
        </div>
      </div>
    </div>
  );
}
