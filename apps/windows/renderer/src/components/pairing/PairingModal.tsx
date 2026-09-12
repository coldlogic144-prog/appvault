import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import ComicPanel from '../ui/ComicPanel';
import ComicButton from '../ui/ComicButton';
import ComicInput from '../ui/ComicInput';
import SpeechBubble from '../ui/SpeechBubble';
import {
  createPairingSession,
  lookupSessionByCode,
  approvePairingSession,
  rejectPairingSession,
  completePairingSession,
  cancelPairingSession,
  listenToPairingSession
} from '../../services/pairing';
import type { PairingSession } from '@comiclink/shared-types';
import {
  QrCode,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  RefreshCw,
  X,
  Radio,
  CameraOff,
  Laptop
} from 'lucide-react';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPairingSuccess?: () => void;
}

export default function PairingModal({ isOpen, onClose, onPairingSuccess }: PairingModalProps) {
  const [activeTab, setActiveTab] = useState<'beacon' | 'link'>('beacon');

  // Beacon (Initiator) state
  const [session, setSession] = useState<PairingSession | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [initiatorLoading, setInitiatorLoading] = useState(false);
  const [initiatorError, setInitiatorError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 mins in seconds

  // Link (Target) state
  const [codeInput, setCodeInput] = useState('');
  const [targetSession, setTargetSession] = useState<PairingSession | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Success state
  const [completedStationName, setCompletedStationName] = useState<string | null>(null);

  // Timer reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Beacon when opening modal on 'beacon' tab
  const startNewBeacon = async () => {
    setInitiatorLoading(true);
    setInitiatorError(null);
    setCompletedStationName(null);
    try {
      const { session: newSession, qrPayload } = await createPairingSession();
      setSession(newSession);
      setTimeLeft(300);

      // Generate crisp SVG QR Code
      const svgString = await QRCode.toString(JSON.stringify(qrPayload), {
        type: 'svg',
        margin: 1,
        color: {
          dark: '#0a1128',
          light: '#f0e6d3'
        }
      });
      setQrSvg(svgString);
    } catch (err: any) {
      setInitiatorError(err.message || 'Failed to initialize pairing session.');
    } finally {
      setInitiatorLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'beacon') {
      startNewBeacon();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, activeTab]);

  // Expiration countdown
  useEffect(() => {
    if (session && session.status === 'pending' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, timeLeft]);

  // Listen for session updates on initiator side
  useEffect(() => {
    if (!session?.sessionId || session.status === 'completed') return;

    const unsubscribe = listenToPairingSession(session.sessionId, async (updated) => {
      if (!updated) return;
      setSession(updated);

      // Target approved! Finalize completion automatically
      if (updated.status === 'approved' && updated.targetDeviceId) {
        try {
          await completePairingSession(updated);
          setCompletedStationName(updated.targetDeviceName || 'Remote Station');
          if (onPairingSuccess) onPairingSuccess();
        } catch (err: any) {
          setInitiatorError(err.message || 'Error finalizing pairing connection.');
        }
      }
    });

    return () => unsubscribe();
  }, [session?.sessionId]);

  // Target: Look up session by entered code
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;

    setLinkLoading(true);
    setLinkError(null);
    setTargetSession(null);

    try {
      const found = await lookupSessionByCode(codeInput.trim());
      setTargetSession(found);
    } catch (err: any) {
      setLinkError(err.message || 'Could not locate pairing beacon.');
    } finally {
      setLinkLoading(false);
    }
  };

  // Target: Approve incoming connection
  const handleApprove = async () => {
    if (!targetSession) return;
    setActionLoading(true);
    setLinkError(null);

    try {
      await approvePairingSession(targetSession.sessionId);
      setCompletedStationName(targetSession.initiatorDeviceName);
      if (onPairingSuccess) onPairingSuccess();
    } catch (err: any) {
      setLinkError(err.message || 'Failed to approve pairing.');
    } finally {
      setActionLoading(false);
    }
  };

  // Target: Reject incoming connection
  const handleReject = async () => {
    if (!targetSession) return;
    setActionLoading(true);
    try {
      await rejectPairingSession(targetSession.sessionId);
      setTargetSession(null);
      setCodeInput('');
    } catch (err: any) {
      setLinkError(err.message || 'Failed to reject pairing.');
    } finally {
      setActionLoading(false);
    }
  };

  // Initiator: Cancel session
  const handleCancelInitiator = async () => {
    if (session?.sessionId && session.status === 'pending') {
      await cancelPairingSession(session.sessionId);
    }
    onClose();
  };

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timerDisplay = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 bg-navy/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-panel border-4 border-ink comic-shadow max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header Bar */}
        <div className="p-4 bg-ink border-b-4 border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-accent-yellow animate-pulse" />
            <h2 className="text-xl font-black uppercase text-text tracking-wide">
              Secure Station Pairing
            </h2>
          </div>
          <button
            onClick={handleCancelInitiator}
            className="text-text-muted hover:text-accent-red p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 border-b-4 border-ink bg-ink/60">
          <button
            type="button"
            onClick={() => {
              setActiveTab('beacon');
              setCompletedStationName(null);
            }}
            className={`py-3 font-bold text-xs uppercase flex items-center justify-center gap-2 border-r-2 border-ink transition-all ${
              activeTab === 'beacon'
                ? 'bg-accent-yellow text-ink'
                : 'text-text-muted hover:text-text hover:bg-ink'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Display Beacon (Show QR)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('link');
              setCompletedStationName(null);
            }}
            className={`py-3 font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all ${
              activeTab === 'link'
                ? 'bg-accent-blue text-ink'
                : 'text-text-muted hover:text-text hover:bg-ink'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Link Station (Enter Code)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 space-y-6">
          {/* SUCCESS BANNER */}
          {completedStationName && (
            <div className="bg-green-500/20 border-2 border-green-500 p-6 flex flex-col items-center text-center gap-3 comic-shadow">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
              <div>
                <h3 className="text-2xl font-black text-text uppercase">Station Linked Successfully!</h3>
                <p className="text-xs text-text-muted uppercase font-bold mt-1">
                  Station <span className="text-accent-yellow">{completedStationName}</span> is now authorized.
                </p>
              </div>
              <ComicButton variant="primary" size="sm" onClick={onClose} className="mt-2">
                RETURN TO FLEET
              </ComicButton>
            </div>
          )}

          {!completedStationName && activeTab === 'beacon' && (
            /* TAB 1: DISPLAY BEACON (QR & CODE) */
            <div className="flex flex-col items-center text-center space-y-4">
              <p className="text-xs text-text-muted max-w-md">
                Scan this QR code from your companion device, or manually enter the single-use 6-character code below.
              </p>

              {initiatorError && (
                <div className="bg-accent-red/20 border-2 border-accent-red p-3 text-accent-red text-xs font-bold uppercase w-full">
                  {initiatorError}
                </div>
              )}

              {initiatorLoading ? (
                <div className="p-12 flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 text-accent-yellow animate-spin" />
                  <span className="text-xs font-bold uppercase text-text-muted">
                    Generating cryptographic beacon...
                  </span>
                </div>
              ) : (
                <>
                  {/* QR Code Container */}
                  <div className="p-4 bg-[#f0e6d3] border-4 border-ink comic-shadow flex items-center justify-center">
                    {qrSvg ? (
                      <div
                        className="w-52 h-52 [&>svg]:w-full [&>svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: qrSvg }}
                      />
                    ) : (
                      <div className="w-52 h-52 flex items-center justify-center text-ink font-bold">
                        Generating...
                      </div>
                    )}
                  </div>

                  {/* 6-Character Manual Pairing Code */}
                  <div className="space-y-1">
                    <div className="text-[10px] text-text-muted uppercase font-bold tracking-widest">
                      Station Pairing Code
                    </div>
                    <div className="bg-ink px-6 py-2 border-2 border-border text-2xl font-mono font-black text-accent-yellow tracking-widest comic-shadow-sm">
                      {session?.pairingCode || '------'}
                    </div>
                  </div>

                  {/* Expiration Display */}
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-text-muted">
                    <Clock className="w-3.5 h-3.5 text-accent-yellow" />
                    <span>Session Expires In: {timerDisplay}</span>
                  </div>

                  {/* Realtime Status Indicator */}
                  <div className="w-full bg-ink/70 p-3 border-2 border-border text-xs flex items-center justify-center gap-2 font-bold uppercase">
                    {session?.status === 'pending' && (
                      <>
                        <Radio className="w-3.5 h-3.5 text-accent-blue animate-pulse" />
                        <span>Awaiting remote station scan & authorization...</span>
                      </>
                    )}
                    {session?.status === 'approved' && (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-green-400 animate-spin" />
                        <span className="text-green-400">Target Approved! Linking station...</span>
                      </>
                    )}
                    {session?.status === 'rejected' && (
                      <span className="text-accent-red">Remote station declined authorization.</span>
                    )}
                    {session?.status === 'cancelled' && (
                      <span className="text-text-muted">Session cancelled by user.</span>
                    )}
                    {session?.status === 'expired' && (
                      <span className="text-accent-red">Session expired. Please generate a new beacon.</span>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <ComicButton variant="ghost" size="sm" onClick={startNewBeacon}>
                      <RefreshCw className="w-3.5 h-3.5" />
                      REGENERATE
                    </ComicButton>
                    <ComicButton variant="secondary" size="sm" onClick={handleCancelInitiator}>
                      CANCEL
                    </ComicButton>
                  </div>
                </>
              )}
            </div>
          )}

          {!completedStationName && activeTab === 'link' && (
            /* TAB 2: LINK STATION (ENTER CODE) */
            <div className="space-y-6">
              {/* Camera Notice */}
              <div className="bg-ink/60 border-2 border-border p-3 flex items-start gap-3 text-xs text-text-muted">
                <CameraOff className="w-5 h-5 text-accent-yellow shrink-0 mt-0.5" />
                <div>
                  <strong className="text-text uppercase font-bold block">Desktop Manual Pairing</strong>
                  Camera scanning is reserved for mobile clients. Enter the 6-character beacon code displayed on the initiating workstation.
                </div>
              </div>

              {linkError && (
                <div className="bg-accent-red/20 border-2 border-accent-red p-3 text-accent-red text-xs font-bold uppercase flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{linkError}</span>
                </div>
              )}

              {/* Code Input Form */}
              {!targetSession ? (
                <form onSubmit={handleLookup} className="space-y-4">
                  <ComicInput
                    label="Station Beacon Code"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. CL-8F921A"
                    maxLength={32}
                    required
                  />

                  <ComicButton
                    type="submit"
                    variant="primary"
                    loading={linkLoading}
                    disabled={linkLoading}
                    className="w-full"
                  >
                    <KeyRound className="w-4 h-4" />
                    LOCATE PAIRING BEACON
                  </ComicButton>
                </form>
              ) : (
                /* TARGET CONSENT APPROVAL SCREEN */
                <ComicPanel title="INCOMING PAIRING AUTHORIZATION">
                  <div className="space-y-4 py-2">
                    <div className="bg-accent-yellow/20 border-2 border-accent-yellow p-3 flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-accent-yellow shrink-0 mt-0.5" />
                      <div className="text-xs text-text leading-relaxed">
                        <strong className="text-accent-yellow uppercase block font-black">
                          Explicit Consent Required
                        </strong>
                        An operative is requesting to authorize a link with this station. Verify the station identity below before granting access.
                      </div>
                    </div>

                    {/* Remote Station Telemetry */}
                    <div className="bg-ink/80 p-3 border-2 border-border space-y-2 text-xs">
                      <div>
                        <div className="text-[10px] text-text-muted uppercase font-bold">Initiating Station</div>
                        <div className="text-sm font-bold text-text uppercase flex items-center gap-1.5 mt-0.5">
                          <Laptop className="w-4 h-4 text-accent-blue" />
                          {targetSession.initiatorDeviceName}
                        </div>
                      </div>

                      <div className="border-t border-border pt-2">
                        <div className="text-[10px] text-text-muted uppercase font-bold">Initiator Device UUID</div>
                        <div className="font-mono text-accent-yellow text-xs break-all mt-0.5">
                          {targetSession.initiatorDeviceId}
                        </div>
                      </div>

                      <div className="border-t border-border pt-2">
                        <div className="text-[10px] text-text-muted uppercase font-bold">Initiator Operative UID</div>
                        <div className="font-mono text-text-muted text-xs break-all mt-0.5">
                          {targetSession.initiatorUserId}
                        </div>
                      </div>
                    </div>

                    <SpeechBubble direction="left" className="text-xs text-text-muted">
                      Authorizing this link allows mutual station-to-station data transfers and encrypted communications.
                    </SpeechBubble>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <ComicButton
                        variant="ghost"
                        size="sm"
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="text-accent-red hover:bg-accent-red hover:text-white"
                      >
                        REJECT INVITATION
                      </ComicButton>
                      <ComicButton
                        variant="primary"
                        size="sm"
                        onClick={handleApprove}
                        loading={actionLoading}
                        disabled={actionLoading}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        AUTHORIZE STATION
                      </ComicButton>
                    </div>
                  </div>
                </ComicPanel>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
