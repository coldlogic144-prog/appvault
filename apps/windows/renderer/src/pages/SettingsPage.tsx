import ComicPanel from '../components/ui/ComicPanel';
import { Settings } from 'lucide-react';
import ComicButton from '../components/ui/ComicButton';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 h-full max-w-4xl mx-auto w-full">
      <h1 className="text-3xl font-black uppercase text-text tracking-wider flex items-center gap-3">
        <Settings className="w-8 h-8 text-text-muted" />
        System Settings
      </h1>
      
      <div className="flex flex-col gap-6">
        <ComicPanel title="PROFILE">
          <div className="py-4">
            <p className="text-text-muted">Account settings placeholder.</p>
          </div>
        </ComicPanel>

        <ComicPanel title="APPEARANCE">
          <div className="py-4">
            <p className="text-text-muted mb-4">Theme preferences placeholder.</p>
            <div className="flex gap-4">
              <ComicButton variant="primary">Dark Mode</ComicButton>
              <ComicButton variant="ghost">Light Mode</ComicButton>
            </div>
          </div>
        </ComicPanel>
      </div>
    </div>
  );
}
