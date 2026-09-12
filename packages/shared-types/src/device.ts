import type { FirestoreTimestamp } from './user';

export type DevicePlatform = 'windows' | 'android' | 'web';

/**
 * users/{uid}/devices/{deviceId} — Registered Client Station.
 * Represents a physical or virtual client instance authorized for this account.
 * Secrets, private keys, or raw auth tokens are strictly forbidden.
 */
export interface Device {
  deviceId: string;
  ownerId: string;
  deviceName: string;
  platform: DevicePlatform;
  appVersion: string;
  lastSeenAt: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
  isRevoked: boolean;
  revokedAt: FirestoreTimestamp | null;
}

export interface RegisterDeviceRequest {
  deviceId: string;
  deviceName: string;
  platform: DevicePlatform;
  appVersion: string;
}

export interface DeviceUpdate {
  deviceName?: string;
  isRevoked?: boolean;
}
