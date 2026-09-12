import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ComicPanel from '../components/ui/ComicPanel';
import ComicButton from '../components/ui/ComicButton';
import SpeechBubble from '../components/ui/SpeechBubble';
import { getLocalDeviceId, getLocalDeviceName, getUserDevices } from '../services/device';
import { getPairedDevices } from '../services/pairing';
import {
  initiateFileTransfer,
  downloadAndVerifyTransferFile,
  rejectTransfer,
  cancelTransfer,
  listenToStationTransfers,
  computeFileChecksum,
  formatFileSize
} from '../services/file-transfer';
import type { FileTransferRecord, Device, PairedDevice } from '@comiclink/shared-types';
import { MAX_FILE_SIZE } from '@comiclink/shared-types';
import {
  FolderSync,
  UploadCloud,
  DownloadCloud,
  ShieldCheck,
  HardDrive,
  Radio,
  FileText,
  FileArchive,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  X,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface DestinationStation {
  id: string; // deviceId
  name: string;
  recipientUid: string;
  platform: string;
  isPairedLink: boolean;
}

export default function FilesPage() {
  const { currentUser } = useAuth();
  const currentDeviceId = getLocalDeviceId();
  const currentDeviceName = getLocalDeviceName();

  const [destinations, setDestinations] = useState<DestinationStation[]>([]);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedChecksum, setStagedChecksum] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [totalUploadBytes, setTotalUploadBytes] = useState(0);

  // Transfer feeds
  const [outboundTransfers, setOutboundTransfers] = useState<FileTransferRecord[]>([]);
  const [inboundTransfers, setInboundTransfers] = useState<FileTransferRecord[]>([]);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [downloadPercent, setDownloadPercent] = useState<number>(0);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load available destination stations (other personal devices + paired devices)
  const loadDestinations = async () => {
    if (!currentUser) return;
    try {
      const [fleet, paired] = await Promise.all([
        getUserDevices(currentUser.uid),
        getPairedDevices(currentUser.uid)
      ]);

      const list: DestinationStation[] = [];

      // 1. Other devices owned by this user
      fleet.forEach((dev: Device) => {
        if (dev.deviceId !== currentDeviceId && !dev.isRevoked) {
          list.push({
            id: dev.deviceId,
            name: dev.deviceName,
            recipientUid: dev.ownerId,
            platform: dev.platform,
            isPairedLink: false
          });
        }
      });

      // 2. Paired station links
      paired.forEach((pair: PairedDevice) => {
        const isDeviceA = pair.deviceA === currentDeviceId;
        const targetDevId = isDeviceA ? pair.deviceB : pair.deviceA;
        const targetDevName = isDeviceA ? pair.deviceNameB : pair.deviceNameA;
        const targetPlatform = isDeviceA ? pair.platformB : pair.platformA;
        const recipientUid = pair.ownerUid;

        if (targetDevId && !list.some((d) => d.id === targetDevId)) {
          list.push({
            id: targetDevId,
            name: targetDevName,
            recipientUid,
            platform: targetPlatform,
            isPairedLink: true
          });
        }
      });

      setDestinations(list);
      if (list.length > 0 && !selectedDestinationId && list[0]) {
        setSelectedDestinationId(list[0].id);
      }
    } catch (err: any) {
      console.warn('[FilesPage] Error loading destination stations:', err);
    }
  };

  useEffect(() => {
    loadDestinations();
  }, [currentUser]);

  // Real-time transfer updates listener
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = listenToStationTransfers({
      onOutboundChange: (records) => setOutboundTransfers(records),
      onInboundChange: (records) => setInboundTransfers(records),
      onError: (err) => {
        console.warn('[FilesPage] Transfer subscription error:', err);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Handle file staging & SHA-256 calculation
  const handleFileSelect = async (file: File) => {
    setFeedback(null);
    if (file.size > MAX_FILE_SIZE) {
      setFeedback({
        type: 'error',
        text: `File "${file.name}" exceeds maximum allowed payload limit (100 MB).`
      });
      return;
    }

    setStagedFile(file);
    setIsHashing(true);
    setStagedChecksum(null);

    try {
      const hash = await computeFileChecksum(file);
      setStagedChecksum(hash);
    } catch (err) {
      console.error('[FilesPage] Checksum generation failed:', err);
      setFeedback({
        type: 'error',
        text: 'Failed to generate cryptographic checksum for selected file.'
      });
    } finally {
      setIsHashing(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Dispatch / Transmit staged file
  const handleTransmitPayload = async () => {
    if (!stagedFile || !selectedDestinationId || !currentUser) return;

    const dest = destinations.find((d) => d.id === selectedDestinationId);
    if (!dest) {
      setFeedback({
        type: 'error',
        text: 'Please select a valid destination station.'
      });
      return;
    }

    setIsUploading(true);
    setUploadPercent(0);
    setFeedback(null);

    try {
      await initiateFileTransfer({
        file: stagedFile,
        targetDeviceId: dest.id,
        targetDeviceName: dest.name,
        recipientId: dest.recipientUid,
        onProgress: (percent, bytes, total) => {
          setUploadPercent(percent);
          setBytesUploaded(bytes);
          setTotalUploadBytes(total);
        }
      });

      setFeedback({
        type: 'success',
        text: `Payload "${stagedFile.name}" dispatched to ${dest.name}. Ready for recipient retrieval.`
      });

      // Reset staged file
      setStagedFile(null);
      setStagedChecksum(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('[FilesPage] File transmission failed:', err);
      setFeedback({
        type: 'error',
        text: err.message || 'File transmission failed. Please verify connection and retry.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Inbound Download & Verification
  const handleDownloadAndVerify = async (transfer: FileTransferRecord) => {
    setDownloadingFileId(transfer.fileId);
    setDownloadPercent(10);
    setFeedback(null);

    try {
      const result = await downloadAndVerifyTransferFile(transfer, (percent) => {
        setDownloadPercent(percent);
      });

      setFeedback({
        type: 'success',
        text: `Payload "${result.fileName}" downloaded and cryptographic SHA-256 integrity verified!`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Download and verification failed.'
      });
    } finally {
      setDownloadingFileId(null);
      setDownloadPercent(0);
    }
  };

  // Inbound Reject
  const handleRejectTransfer = async (fileId: string) => {
    try {
      await rejectTransfer(fileId);
      setFeedback({
        type: 'info',
        text: 'Incoming payload declined.'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Failed to reject transfer.'
      });
    }
  };

  // Outbound Cancel
  const handleCancelTransfer = async (fileId: string) => {
    try {
      await cancelTransfer(fileId);
      setFeedback({
        type: 'info',
        text: 'Outbound payload cancelled.'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Failed to cancel transfer.'
      });
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-accent-yellow" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed'))
      return <FileArchive className="w-5 h-5 text-accent-red" />;
    return <FileText className="w-5 h-5 text-accent-blue" />;
  };

  return (
    <div className="flex flex-col gap-6 h-full max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b-2 border-border">
        <div>
          <h1 className="text-3xl font-black uppercase text-text tracking-wider flex items-center gap-3">
            <FolderSync className="w-8 h-8 text-accent-red" />
            Data Courier Bay
          </h1>
          <p className="text-text-muted text-sm font-medium mt-1">
            Secure, consent-governed payload dispatch between verified ComicLink stations.
          </p>
        </div>

        {/* Station Ticker */}
        <div className="flex items-center gap-3 bg-ink/70 border-2 border-border px-4 py-2 rounded">
          <Radio className="w-4 h-4 text-accent-blue animate-pulse" />
          <div className="text-xs">
            <span className="text-text-muted uppercase font-bold">Active Station: </span>
            <span className="text-accent-blue font-bold">{currentDeviceName}</span>
          </div>
          <button
            onClick={loadDestinations}
            title="Refresh Stations"
            className="p-1 hover:text-accent-yellow text-text-muted transition-colors ml-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`border-2 p-3 rounded flex items-center justify-between gap-3 text-sm font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-accent-red/20 border-accent-red text-red-300'
              : 'bg-accent-blue/20 border-accent-blue text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' && <ShieldCheck className="w-5 h-5 flex-shrink-0" />}
            {feedback.type === 'error' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
            {feedback.type === 'info' && <Radio className="w-5 h-5 flex-shrink-0" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grid Layout: Dispatch Bay (Left) & Receiving Bay (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* ============================================================ */}
        {/* LEFT COLUMN: DISPATCH BAY (STAGING & UPLOAD) */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <ComicPanel title="TRANSMIT PAYLOAD (OUTBOUND)">
            <div className="flex flex-col gap-4">
              {/* Destination Station Picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase font-bold tracking-wider text-text-muted">
                  Target Station Destination:
                </label>
                {destinations.length === 0 ? (
                  <div className="text-xs bg-ink/60 border border-border p-3 rounded text-text-muted">
                    No paired stations detected. Pair a station on the{' '}
                    <a href="/devices" className="text-accent-blue underline font-bold">
                      Stations page
                    </a>{' '}
                    to enable inter-station dispatch.
                  </div>
                ) : (
                  <select
                    value={selectedDestinationId}
                    onChange={(e) => setSelectedDestinationId(e.target.value)}
                    disabled={isUploading}
                    className="w-full bg-navy border-2 border-border text-text px-3 py-2 text-sm rounded font-bold focus:border-accent-blue focus:outline-none"
                  >
                    {destinations.map((dest) => (
                      <option key={dest.id} value={dest.id}>
                        {dest.name} ({dest.platform.toUpperCase()}) {dest.isPairedLink ? '• Paired Link' : '• My Device'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors text-center ${
                  isDragging
                    ? 'border-accent-yellow bg-accent-yellow/10'
                    : 'border-border hover:border-accent-blue bg-ink/40 hover:bg-ink/70'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <div className="p-3 bg-navy border-2 border-border rounded-full text-accent-blue">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase text-text">
                    {stagedFile ? 'Click or Drag to replace file' : 'Select or Drag File to Transmit'}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">Maximum verified payload size: 100 MB</p>
                </div>
              </div>

              {/* Staged File Card */}
              {stagedFile && (
                <div className="bg-ink border-2 border-border p-4 rounded flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {getFileIcon(stagedFile.type)}
                      <div className="min-w-0">
                        <p className="text-sm font-black text-text truncate">{stagedFile.name}</p>
                        <p className="text-xs text-text-muted">{formatFileSize(stagedFile.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagedFile(null);
                        setStagedChecksum(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      disabled={isUploading}
                      className="text-text-muted hover:text-accent-red p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Cryptographic Hash Badge */}
                  <div className="bg-navy/80 border border-border/80 p-2.5 rounded flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between text-text-muted font-bold">
                      <span className="flex items-center gap-1.5 text-accent-yellow">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        SHA-256 Cryptographic Checksum:
                      </span>
                      {isHashing && <span className="text-accent-yellow animate-pulse">Hashing payload...</span>}
                    </div>
                    <code className="text-[11px] font-mono text-text break-all">
                      {isHashing ? 'Computing hash...' : stagedChecksum || 'Calculating...'}
                    </code>
                  </div>

                  {/* Upload Progress */}
                  {isUploading && (
                    <div className="flex flex-col gap-1 pt-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-accent-blue">Beaming Payload...</span>
                        <span className="text-text">{uploadPercent}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-navy rounded-full overflow-hidden border border-border">
                        <div
                          className="h-full bg-accent-blue transition-all duration-200"
                          style={{ width: `${uploadPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-text-muted">
                        <span>{formatFileSize(bytesUploaded)}</span>
                        <span>{formatFileSize(totalUploadBytes)}</span>
                      </div>
                    </div>
                  )}

                  {/* Transmit Button */}
                  <ComicButton
                    variant="primary"
                    size="md"
                    onClick={handleTransmitPayload}
                    disabled={isUploading || isHashing || !selectedDestinationId}
                    loading={isUploading}
                    className="w-full mt-1"
                  >
                    <ArrowUpRight className="w-4 h-4 mr-1.5" />
                    {isUploading ? 'Dispatching Payload...' : 'Transmit Payload'}
                  </ComicButton>
                </div>
              )}
            </div>
          </ComicPanel>

          {/* Outbound Queue Log */}
          <ComicPanel title="OUTBOUND TRANSMISSION LOG">
            {outboundTransfers.length === 0 ? (
              <div className="text-center py-6 text-text-muted text-xs font-bold uppercase flex flex-col items-center gap-1">
                <HardDrive className="w-7 h-7 opacity-40 mb-1" />
                <p>No outbound transmissions on record.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                {outboundTransfers.map((tx) => (
                  <div
                    key={tx.fileId}
                    className="bg-ink/70 border border-border p-2.5 rounded flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-text truncate">{tx.fileName}</p>
                        <span className="text-[10px] text-text-muted uppercase">({formatFileSize(tx.fileSize)})</span>
                      </div>
                      <p className="text-[11px] text-text-muted truncate mt-0.5">
                        Target: <span className="text-accent-blue">{tx.targetDeviceName}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                          tx.status === 'completed'
                            ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                            : tx.status === 'ready'
                            ? 'bg-yellow-950 border-accent-yellow text-accent-yellow'
                            : tx.status === 'uploading' || tx.status === 'pending'
                            ? 'bg-blue-950 border-accent-blue text-accent-blue animate-pulse'
                            : 'bg-red-950 border-accent-red text-red-300'
                        }`}
                      >
                        {tx.status}
                      </span>

                      {(tx.status === 'pending' || tx.status === 'uploading' || tx.status === 'ready') && (
                        <button
                          onClick={() => handleCancelTransfer(tx.fileId)}
                          title="Cancel Transfer"
                          className="p-1 hover:text-accent-red text-text-muted transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ComicPanel>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: RECEIVING BAY (INBOUND INTERCEPT) */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <ComicPanel title="RECEIVING CONDUIT (INBOUND)">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase font-bold text-text-muted">
                  Incoming Payloads for Station: <span className="text-accent-blue">{currentDeviceName}</span>
                </p>
                <span className="text-xs font-bold text-accent-yellow">
                  {inboundTransfers.filter((t) => t.status === 'ready').length} Ready for Retrieval
                </span>
              </div>

              {inboundTransfers.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-border rounded flex flex-col items-center justify-center text-center p-6 text-text-muted">
                  <DownloadCloud className="w-12 h-12 opacity-30 mb-3" />
                  <p className="font-black text-sm uppercase text-text">Receiving Conduit Clear</p>
                  <p className="text-xs text-text-muted mt-1 max-w-sm">
                    No incoming transmissions currently queued. When another station beams a file to this device, it
                    will appear here for explicit acceptance and SHA-256 verification.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {inboundTransfers.map((tx) => {
                    const isReady = tx.status === 'ready';
                    const isDownloadingThis = downloadingFileId === tx.fileId;

                    return (
                      <div
                        key={tx.fileId}
                        className={`border-2 p-4 rounded transition-all flex flex-col gap-3 ${
                          isReady
                            ? 'bg-ink border-accent-blue/60 shadow-[2px_2px_0px_rgba(0,180,216,0.3)]'
                            : tx.status === 'completed'
                            ? 'bg-ink/40 border-emerald-500/30'
                            : 'bg-ink/30 border-border opacity-70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="p-2.5 bg-navy border-2 border-border rounded mt-0.5">
                              {getFileIcon(tx.mimeType)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-black text-text truncate">{tx.fileName}</h4>
                              <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                                <span>{formatFileSize(tx.fileSize)}</span>
                                <span>•</span>
                                <span>
                                  From Operative Station:{' '}
                                  <strong className="text-accent-yellow">{tx.sourceDeviceName}</strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-black uppercase px-2.5 py-1 rounded border ${
                              tx.status === 'completed'
                                ? 'bg-emerald-950 border-emerald-500 text-emerald-300 flex items-center gap-1'
                                : tx.status === 'ready'
                                ? 'bg-yellow-950 border-accent-yellow text-accent-yellow animate-pulse'
                                : tx.status === 'rejected'
                                ? 'bg-zinc-900 border-zinc-700 text-zinc-400'
                                : 'bg-red-950 border-accent-red text-red-300'
                            }`}
                          >
                            {tx.status === 'completed' && <CheckCircle2 className="w-3 h-3 inline" />}
                            {tx.status}
                          </span>
                        </div>

                        {/* Cryptographic Checksum Bar */}
                        <div className="bg-navy border border-border/80 px-3 py-1.5 rounded flex items-center justify-between text-xs font-mono">
                          <div className="flex items-center gap-1.5 text-text-muted truncate mr-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-accent-yellow flex-shrink-0" />
                            <span className="truncate">SHA-256: {tx.checksum}</span>
                          </div>
                          {tx.status === 'completed' && (
                            <span className="text-emerald-400 text-[10px] font-sans font-bold uppercase flex-shrink-0">
                              Verified
                            </span>
                          )}
                        </div>

                        {/* Download Progress if active */}
                        {isDownloadingThis && (
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-accent-yellow">Downloading & Verifying Integrity...</span>
                              <span className="text-text">{downloadPercent}%</span>
                            </div>
                            <div className="w-full h-2 bg-navy rounded-full overflow-hidden border border-border">
                              <div
                                className="h-full bg-accent-yellow transition-all duration-200"
                                style={{ width: `${downloadPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Actions for Ready Transfers */}
                        {isReady && !isDownloadingThis && (
                          <div className="flex items-center gap-3 pt-1 border-t border-border/50">
                            <ComicButton
                              variant="accent"
                              size="sm"
                              onClick={() => handleDownloadAndVerify(tx)}
                              className="flex-1"
                            >
                              <DownloadCloud className="w-4 h-4 mr-1.5" />
                              Accept & Verify Download
                            </ComicButton>
                            <ComicButton
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRejectTransfer(tx.fileId)}
                              className="text-text-muted hover:text-accent-red"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Decline
                            </ComicButton>
                          </div>
                        )}

                        {/* Failure reason explanation if failed */}
                        {tx.status === 'failed' && tx.failureReason && (
                          <div className="text-xs bg-red-950/40 border border-accent-red p-2 rounded text-red-300 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span>{tx.failureReason}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ComicPanel>

          {/* Security & Audit Notes */}
          <SpeechBubble direction="left">
            <div className="text-xs text-text-muted space-y-1">
              <p className="font-bold text-text">🛡️ Operative Security Protocol:</p>
              <p>
                Every payload transmission computes a SHA-256 cryptographic digest before beaming. Recipient stations
                strictly recalculate and verify the digest prior to disk write. Transmissions exceeding 100 MB or
                violating MIME bounds are rejected at the storage gateway.
              </p>
            </div>
          </SpeechBubble>
        </div>
      </div>
    </div>
  );
}
