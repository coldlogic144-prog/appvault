import ComicPanel from '../components/ui/ComicPanel';
import { MonitorSmartphone } from 'lucide-react';
import ComicButton from '../components/ui/ComicButton';

export default function DevicesPage() {
  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black uppercase text-text tracking-wider flex items-center gap-3">
          <MonitorSmartphone className="w-8 h-8 text-accent-blue" />
          Device Network
        </h1>
        <ComicButton variant="accent">Pair Device</ComicButton>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        <ComicPanel title="THIS DEVICE">
          <div className="flex flex-col gap-2 mt-2">
            <h3 className="font-bold text-xl text-text uppercase">Windows Desktop</h3>
            <span className="text-accent-blue font-bold text-sm">ONLINE</span>
          </div>
        </ComicPanel>
        
        <div className="border-4 border-dashed border-border rounded-lg flex items-center justify-center p-8 min-h-[150px] text-text-muted font-bold uppercase hover:bg-ink hover:border-accent-yellow transition-colors cursor-pointer">
          + Add New Device
        </div>
      </div>
    </div>
  );
}
