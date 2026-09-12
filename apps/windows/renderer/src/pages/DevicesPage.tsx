import { useState, useEffect } from 'react';
import ComicPanel from '../components/ui/ComicPanel';
import ComicButton from '../components/ui/ComicButton';
import { useAuth } from '../context/AuthContext';
import {
  getUserDevices,
  revokeDevice,
  updateDeviceCallsign,
  getLocalDeviceId
} from '../services/device';
import { getPairedDevices } from '../services/pairing';
import type { Device, PairedDevice } from '@comiclink/shared-types';
import PairingModal from '../components/pairing/PairingModal';
import {
  MonitorSmartphone,
  Laptop,
  Smartphone,
  Globe,
  ShieldAlert,
  ShieldCheck,
  Edit3,
  RefreshCw,
  Radio,
  Plus,
  Key,
  Check,
  X,
  Link2
} from 'lucide-react';

export default function DevicesPage() {
  const { currentUser } = useAuth();
  const currentDeviceId = getLocalDeviceId();

  const [devices, setDevices] = useState<Device[]>([]);
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);

  // Renaming station state
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Revocation confirm modal state
  const [revokingDevice, setRevokingDevice] = useState<Device | null>(null);

  const fetchFleet = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const [fleet, paired] = await Promise.all([
        getUserDevices(currentUser.uid),
        getPairedDevices(currentUser.uid)
      ]);
      setDevices(fleet);
      setPairedDevices(paired);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch registered devices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, [currentUser]);

  const handleStartRename = (device: Device) => {
    setEditingDeviceId(device.deviceId);
    setRenameValue(device.deviceName);
  };

  const handleCancelRename = () => {
    setEditingDeviceId(null);
    setRenameValue('');
  };

  const handleSaveRename = async (deviceId: string) => {
    if (!currentUser || !renameValue.trim()) return;
    setActionLoading(true);
    try {
      await updateDeviceCallsign(currentUser.uid, deviceId, renameValue.trim());
      setDevices((prev) =>
        prev.map((d) => (d.deviceId === deviceId ? { ...d, deviceName: renameValue.trim() } : d))
      );
      setEditingDeviceId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update device name.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!currentUser || !revokingDevice) return;
    setActionLoading(true);
    try {
      await revokeDevice(currentUser.uid, revokingDevice.deviceId);
      setDevices((prev) =>
        prev.map((d) =>
          d.deviceId === revokingDevice.deviceId ? { ...d, isRevoked: true } : d
        )
      );
      setRevokingDevice(null);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke device authorization.');
    } finally {
      setActionLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'windows':
        return <Laptop className="w-5 h-5 text-accent-blue" />;
      case 'android':
        return <Smartphone className="w-5 h-5 text-green-400" />;
      case 'web':
        return <Globe className="w-5 h-5 text-accent-yellow" />;
      default:
        return <MonitorSmartphone className="w-5 h-5 text-text-muted" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-ink pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-text tracking-wider flex items-center gap-3">
            <MonitorSmartphone className="w-8 h-8 text-accent-blue" strokeWidth={3} />
            Authorized Stations
          </h1>
          <p className="text-xs text-text-muted uppercase font-bold tracking-widest mt-1">
            Cryptographic Device Fleet & Subcollection Registry
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ComicButton
            variant="accent"
            size="sm"
            onClick={() => setIsPairingModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>PAIR STATION</span>
          </ComicButton>

          <ComicButton
            variant="ghost"
            size="sm"
            onClick={fetchFleet}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC FLEET</span>
          </ComicButton>
        </div>
      </div>

      {error && (
        <div className="bg-accent-red/20 border-2 border-accent-red p-3 text-accent-red text-xs font-bold uppercase flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Fleet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => {
          const isThisStation = device.deviceId === currentDeviceId;
          const isEditing = editingDeviceId === device.deviceId;

          return (
            <ComicPanel
              key={device.deviceId}
              title={isThisStation ? 'THIS STATION (HOST)' : 'REMOTE STATION'}
              className={isThisStation ? 'border-accent-yellow' : ''}
            >
              <div className="py-2 space-y-4">
                {/* Station Title & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-ink border border-border">
                      {getPlatformIcon(device.platform)}
                    </div>
                    <div>
                      {isEditing ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="bg-ink border border-accent-blue text-text px-2 py-1 text-xs outline-none uppercase font-bold"
                            maxLength={100}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(device.deviceId)}
                            disabled={actionLoading}
                            className="p-1 bg-accent-yellow text-ink border border-ink hover:bg-yellow-400"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleCancelRename}
                            className="p-1 bg-ink text-text-muted border border-border hover:text-text"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-lg text-text uppercase leading-snug">
                            {device.deviceName}
                          </h3>
                          {!device.isRevoked && (
                            <button
                              onClick={() => handleStartRename(device)}
                              className="text-text-muted hover:text-accent-yellow"
                              title="Rename station"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                      <div className="text-[10px] uppercase font-bold text-text-muted">
                        Platform: {device.platform} • App: v{device.appVersion}
                      </div>
                    </div>
                  </div>

                  {device.isRevoked ? (
                    <span className="bg-accent-red/20 border border-accent-red text-accent-red text-[10px] font-black px-2 py-0.5 uppercase tracking-wider">
                      REVOKED
                    </span>
                  ) : (
                    <span className="bg-green-500/20 border border-green-500 text-green-400 text-[10px] font-black px-2 py-0.5 uppercase tracking-wider flex items-center gap-1">
                      <Radio className="w-2.5 h-2.5 animate-pulse" />
                      ACTIVE
                    </span>
                  )}
                </div>

                {/* Monospace UUID Box */}
                <div>
                  <div className="text-[10px] text-text-muted uppercase font-bold mb-1">
                    Station Identifier (UUID)
                  </div>
                  <div className="bg-ink/70 border border-border p-2 text-xs font-mono text-accent-yellow break-all">
                    {device.deviceId}
                  </div>
                </div>

                {/* Actions & Warnings */}
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  {isThisStation && (
                    <span className="text-[10px] font-bold text-accent-yellow uppercase flex items-center gap-1">
                      <Key className="w-3 h-3" /> ACTIVE LOCAL CLIENT
                    </span>
                  )}

                  {!device.isRevoked ? (
                    <ComicButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevokingDevice(device)}
                      className="text-xs text-accent-red border-accent-red/50 hover:bg-accent-red hover:text-white ml-auto"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>REVOKE</span>
                    </ComicButton>
                  ) : (
                    <span className="text-[10px] text-text-muted italic ml-auto">
                      Authorization Terminated
                    </span>
                  )}
                </div>
              </div>
            </ComicPanel>
          );
        })}

        {/* Add New Station Panel */}
        <div
          onClick={() => setIsPairingModalOpen(true)}
          className="border-4 border-dashed border-border rounded-none p-6 flex flex-col items-center justify-center text-center gap-3 bg-panel/30 hover:border-accent-yellow transition-colors cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-ink border-2 border-border flex items-center justify-center text-text-muted group-hover:text-accent-yellow">
            <Plus className="w-6 h-6 text-accent-yellow" />
          </div>
          <div>
            <h4 className="font-black text-text uppercase text-base tracking-wide">
              Pair Additional Station
            </h4>
            <p className="text-xs text-text-muted max-w-xs mt-1">
              Initialize cryptographic QR beacon or link companion device via 6-digit code.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-accent-yellow bg-ink px-2.5 py-1 border border-border uppercase flex items-center gap-1">
            <Radio className="w-2.5 h-2.5" /> Launch Pairing Beacon
          </span>
        </div>
      </div>

      {/* Paired Stations Section */}
      {pairedDevices.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="border-b-2 border-border pb-2 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-accent-yellow" />
            <h2 className="text-xl font-black uppercase text-text tracking-wide">
              Mutual Station Links ({pairedDevices.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pairedDevices.map((pair) => (
              <ComicPanel key={pair.pairId} title="MUTUAL STATION LINK">
                <div className="py-2 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text uppercase flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-accent-blue" />
                      {pair.deviceNameA}
                    </span>
                    <span className="text-accent-yellow font-bold">⟷</span>
                    <span className="font-bold text-text uppercase flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-green-400" />
                      {pair.deviceNameB}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-text-muted bg-ink p-1.5 border border-border truncate">
                    Link: {pair.pairId}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-green-400 font-bold uppercase">
                    <ShieldCheck className="w-3 h-3" /> Authorized Peer Channel
                  </div>
                </div>
              </ComicPanel>
            ))}
          </div>
        </div>
      )}

      {/* Revocation Confirmation Modal */}
      {revokingDevice && (
        <div className="fixed inset-0 bg-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-panel border-4 border-ink comic-shadow max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 border-b-2 border-border pb-3">
              <ShieldAlert className="w-6 h-6 text-accent-red" strokeWidth={3} />
              <h3 className="text-xl font-black uppercase text-text tracking-wide">
                Revoke Station Access?
              </h3>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to revoke authorization for{' '}
              <strong className="text-text uppercase font-bold">{revokingDevice.deviceName}</strong>?
              This station will be severed from the communications network and marked as revoked.
            </p>

            <div className="bg-ink p-2 border border-border text-[10px] font-mono text-accent-red break-all">
              Target UUID: {revokingDevice.deviceId}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <ComicButton
                variant="ghost"
                size="sm"
                onClick={() => setRevokingDevice(null)}
                disabled={actionLoading}
              >
                CANCEL
              </ComicButton>
              <ComicButton
                variant="primary"
                size="sm"
                onClick={handleConfirmRevoke}
                loading={actionLoading}
                disabled={actionLoading}
              >
                CONFIRM REVOCATION
              </ComicButton>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Pairing Modal */}
      <PairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        onPairingSuccess={() => {
          fetchFleet();
        }}
      />
    </div>
  );
}

