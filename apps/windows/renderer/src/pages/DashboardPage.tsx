import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ComicPanel from '../components/ui/ComicPanel';
import ComicButton from '../components/ui/ComicButton';
import {
  LayoutDashboard,
  Radio,
  ShieldCheck,
  ShieldAlert,
  MonitorSmartphone,
  FolderSync,
  MessageSquare,
  Globe,
  Settings,
  User,
  Sparkles,
  Layers
} from 'lucide-react';
import { getLocalDeviceName } from '../services/device';

export default function DashboardPage() {
  const { currentUser, userAccount, publicProfile, currentDeviceId } = useAuth();

  const callsign = publicProfile?.displayName || currentUser?.displayName || 'OPERATIVE';
  const email = currentUser?.email || 'N/A';
  const isVerified = currentUser?.emailVerified ?? false;
  const role = userAccount?.role || 'user';
  const accountStatus = userAccount?.accountStatus || 'active';
  const presence = publicProfile?.presenceStatus || 'online';
  const localStationName = getLocalDeviceName();

  const presenceBadgeColor = {
    online: 'bg-green-500 border-green-700 text-white',
    away: 'bg-accent-yellow border-yellow-700 text-ink',
    offline: 'bg-text-muted border-gray-600 text-ink'
  }[presence] || 'bg-green-500 border-green-700 text-white';

  return (
    <div className="flex flex-col gap-6 h-full pb-8">
      {/* Page Title & Status Beacon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-ink pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-text tracking-wider flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-accent-yellow" strokeWidth={3} />
            Command Center
          </h1>
          <p className="text-xs text-text-muted uppercase font-bold tracking-widest mt-1">
            Operative Dossier & Station Directives
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 font-bold text-xs uppercase border-2 border-ink comic-shadow-sm ${presenceBadgeColor}`}
            title="Self-reported profile status set in Settings"
          >
            <Radio className="w-3.5 h-3.5" />
            Beacon: {presence} (Self-Reported)
          </span>
          <span className="bg-panel border-2 border-ink text-accent-blue px-3 py-1 text-xs font-mono font-bold comic-shadow-sm">
            v0.1.0
          </span>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operative Identity Panel */}
        <ComicPanel title="OPERATIVE PROFILE" className="lg:col-span-2">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 py-2">
            <div className="relative">
              <div className="w-20 h-20 bg-accent-blue border-4 border-ink comic-shadow flex items-center justify-center text-ink text-2xl font-black">
                {publicProfile?.photoURL ? (
                  <img
                    src={publicProfile.photoURL}
                    alt={callsign}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-10 h-10" strokeWidth={3} />
                )}
              </div>
              <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-ink ${presence === 'online' ? 'bg-green-400' : presence === 'away' ? 'bg-accent-yellow' : 'bg-gray-500'}`} />
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-text uppercase tracking-wide">
                  {callsign}
                </h2>
                <span className="bg-accent-yellow text-ink text-xs font-black px-2 py-0.5 border border-ink uppercase tracking-wider">
                  ROLE: {role}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 border border-ink uppercase flex items-center gap-1 ${
                  isVerified
                    ? 'bg-green-500/20 text-green-300 border-green-500'
                    : 'bg-accent-red/20 text-accent-red border-accent-red'
                }`}>
                  {isVerified ? (
                    <>
                      <ShieldCheck className="w-3 h-3" /> VERIFIED
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3 h-3" /> UNVERIFIED
                    </>
                  )}
                </span>
              </div>

              <p className="text-sm font-mono text-text-muted break-all">
                {email}
              </p>

              {publicProfile?.bio ? (
                <p className="text-sm text-text bg-ink/50 p-2.5 border-2 border-border italic">
                  "{publicProfile.bio}"
                </p>
              ) : (
                <p className="text-xs text-text-muted italic">
                  No mission bio set. Configure in Settings.
                </p>
              )}
            </div>

            <div className="self-stretch md:self-center flex md:flex-col justify-end gap-2">
              <Link to="/settings">
                <ComicButton variant="secondary" size="sm" className="w-full">
                  <Settings className="w-3.5 h-3.5" />
                  <span>EDIT PROFILE</span>
                </ComicButton>
              </Link>
            </div>
          </div>
        </ComicPanel>

        {/* Local Station Status */}
        <ComicPanel title="LOCAL STATION TELEMETRY">
          <div className="space-y-3 py-1">
            <div>
              <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Callsign</div>
              <div className="text-base font-bold text-text uppercase flex items-center gap-1.5">
                <MonitorSmartphone className="w-4 h-4 text-accent-blue" />
                {localStationName}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Station UUID</div>
              <div className="text-xs font-mono text-accent-yellow bg-ink/70 p-1.5 border border-border break-all">
                {currentDeviceId}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t-2 border-border">
              <div>
                <div className="text-[10px] text-text-muted uppercase font-bold">Platform</div>
                <div className="text-xs font-bold text-text uppercase">Windows x64</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase font-bold">Account State</div>
                <div className="text-xs font-bold text-green-400 uppercase">{accountStatus}</div>
              </div>
            </div>

            <div className="pt-2">
              <Link to="/devices" className="block">
                <ComicButton variant="accent" size="sm" className="w-full">
                  <Layers className="w-3.5 h-3.5" />
                  <span>VIEW ALL STATIONS</span>
                </ComicButton>
              </Link>
            </div>
          </div>
        </ComicPanel>
      </div>

      {/* Network Modules / Roadmap Panel */}
      <ComicPanel title="COMMUNICATIONS NETWORK DIRECTORY">
        <div className="py-2 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted font-bold uppercase">
              Operational Roadmap & System Architecture
            </p>
            <span className="text-xs text-accent-yellow font-bold uppercase flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Active Phase: Phase 2
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Phase 3 Preview */}
            <div className="bg-ink/60 border-2 border-border p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-accent-blue uppercase tracking-wider">PHASE 3</span>
                  <span className="text-[10px] font-bold bg-panel border border-border px-1.5 py-0.5 text-text-muted uppercase">UPCOMING</span>
                </div>
                <h3 className="font-bold text-text uppercase flex items-center gap-2 mb-1">
                  <FolderSync className="w-4 h-4 text-accent-blue" />
                  Encrypted File Relay
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Peer-to-peer and cloud-relayed file dispatch with chunked upload, progress tracking, and hash verification.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 text-[10px] font-bold text-text-muted uppercase">
                Storage Rules & Transfer Pipeline
              </div>
            </div>

            {/* Phase 4 Preview */}
            <div className="bg-ink/60 border-2 border-border p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-accent-yellow uppercase tracking-wider">PHASE 4</span>
                  <span className="text-[10px] font-bold bg-panel border border-border px-1.5 py-0.5 text-text-muted uppercase">UPCOMING</span>
                </div>
                <h3 className="font-bold text-text uppercase flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-accent-yellow" />
                  Tactical Secure Chat
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Realtime end-to-end communication channels with rich markdown preview, speech bubble balloons, and typing signals.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 text-[10px] font-bold text-text-muted uppercase">
                Conversations Subcollection
              </div>
            </div>

            {/* Phase 5 Preview */}
            <div className="bg-ink/60 border-2 border-border p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-accent-red uppercase tracking-wider">PHASE 5</span>
                  <span className="text-[10px] font-bold bg-panel border border-border px-1.5 py-0.5 text-text-muted uppercase">UPCOMING</span>
                </div>
                <h3 className="font-bold text-text uppercase flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-accent-red" />
                  Broadsheet Feed
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Public comic panel updates, community notices, reaction stamps, and moderation reporting queues.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 text-[10px] font-bold text-text-muted uppercase">
                Public Feeds & Audit Pipeline
              </div>
            </div>
          </div>
        </div>
      </ComicPanel>
    </div>
  );
}
