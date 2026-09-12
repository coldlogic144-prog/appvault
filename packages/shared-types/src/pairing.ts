import type { Timestamp } from './user';
import type { DevicePlatform } from './device';

export type PairingSessionStatus = 'pending' | 'scanned' | 'confirmed' | 'expired' | 'revoked';

export interface PairingSession {
  sessionId: string;
  initiatorUid: string;
  sourceDeviceId: string;
  status: PairingSessionStatus;
  targetDeviceId: string | null;
  pairingCode: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  usedAt: Timestamp | null;
}

export interface PairedDevice {
  pairId: string;
  ownerUid: string;
  deviceA: string;
  deviceB: string;
  platformA: DevicePlatform;
  platformB: DevicePlatform;
  status: 'active' | 'unpaired';
  createdAt: Timestamp;
  unpairedAt: Timestamp | null;
}

export interface CreatePairingRequest {
  sourceDeviceId: string;
}

export interface ScanPairingRequest {
  pairingCode: string;
  targetDeviceId: string;
}

export interface QRPairingPayload {
  pairingCode: string;
  expiresAt: number;
}
