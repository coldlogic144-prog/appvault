import ComicPanel from '../components/ui/ComicPanel';
import { FolderSync } from 'lucide-react';

export default function FilesPage() {
  return (
    <div className="flex flex-col gap-6 h-full">
      <h1 className="text-3xl font-black uppercase text-text tracking-wider flex items-center gap-3">
        <FolderSync className="w-8 h-8 text-accent-red" />
        Data Transfer
      </h1>
      
      <ComicPanel title="ACTIVE TRANSFERS" className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center text-text-muted font-bold uppercase flex-col gap-2">
          <FolderSync className="w-12 h-12 opacity-50" />
          <p>No active file transfers.</p>
          <p className="text-xs">Drag and drop files here to begin.</p>
        </div>
      </ComicPanel>
    </div>
  );
}
