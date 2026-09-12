import type { FirestoreTimestamp } from './user';
import type { DevicePlatform } from './device';

export type PairingSessionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'completed'
  | 'cancelled';

/**
 * pairingSessions/{sessionId} — Short-lived station connection request.
 * Contains no long-lived secrets, tokens, or private keys.
 */
export interface PairingSession {
  sessionId: string;
  initiatorUserId: string;
  initiatorDeviceId: string;
  initiatorDeviceName: string;
  pairingCode: string;
  status: PairingSessionStatus;
  targetUserId: string | null;
  targetDeviceId: string | null;
  targetDeviceName: string | null;
  challengeHash: string;
  createdAt: FirestoreTimestamp;
  expiresAt: FirestoreTimestamp;
  approvedAt: FirestoreTimestamp | null;
  completedAt: FirestoreTimestamp | null;
  cancelledAt: FirestoreTimestamp | null;
  rejectedAt: FirestoreTimestamp | null;
}

/**
 * pairedDevices/{pairId} — Established mutual station authorization link.
 */
export interface PairedDevice {
  pairId: string;
  ownerUid: string;
  deviceA: string;
  deviceB: string;
  platformA: DevicePlatform;
  platformB: DevicePlatform;
  deviceNameA: string;
  deviceNameB: string;
  status: 'active' | 'unpaired';
  createdAt: FirestoreTimestamp;
  unpairedAt: FirestoreTimestamp | null;
}

/**
 * Non-sensitive QR code payload format.
 */
export interface QRPairingPayload {
  v: number;
  sid: string;
  code: string;
  initDev: string;
  exp: number;
  ch: string;
}

export interface CreatePairingRequest {
  initiatorDeviceId: string;
  initiatorDeviceName: string;
}

export interface ApprovePairingRequest {
  sessionId: string;
  targetDeviceId: string;
  targetDeviceName: string;
}
