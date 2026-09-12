import { User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isEmulatorMode } from '../../services/firebase';
import ComicButton from '../ui/ComicButton';

export default function TopBar() {
  const { currentUser, userAccount, publicProfile, logout } = useAuth();

  const displayName = publicProfile?.displayName || currentUser?.displayName || currentUser?.email || 'AGENT';

  return (
    <header className="h-16 bg-panel border-b-4 border-ink flex items-center justify-between px-6 z-10">
      <div className="flex items-center gap-3">
        <div className="font-bold text-lg text-text uppercase tracking-wider">
          HQ COMMUNICATIONS
        </div>
        {isEmulatorMode && (
          <span className="bg-accent-yellow/20 border border-accent-yellow text-accent-yellow text-xs font-bold px-2 py-0.5 uppercase tracking-wider comic-shadow-sm">
            Emulator
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 pl-4 border-l-2 border-border">
          <div className="w-8 h-8 bg-accent-blue border-2 border-ink comic-shadow flex items-center justify-center text-ink rounded-full">
            <User className="w-4 h-4" strokeWidth={3} />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="font-bold text-sm text-text leading-tight">{displayName}</span>
            {userAccount?.role && (
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                {userAccount.role}
              </span>
            )}
          </div>
        </div>

        <ComicButton
          variant="ghost"
          size="sm"
          onClick={() => logout()}
          className="text-xs flex items-center gap-1.5 py-1 px-3"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5 text-accent-red" />
          <span>SIGN OUT</span>
        </ComicButton>
      </div>
    </header>
  );
}
