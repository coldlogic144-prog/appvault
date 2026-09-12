import type { Timestamp } from './user';

export type DevicePlatform = 'windows' | 'android' | 'web';

export interface Device {
  deviceId: string;
  userId: string;
  deviceName: string;
  platform: DevicePlatform;
  appVersion: string;
  isOnline: boolean;
  lastSeenAt: Timestamp;
  pushToken: string | null;
  revoked: boolean;
  createdAt: Timestamp;
}

export interface RegisterDeviceRequest {
  deviceName: string;
  platform: DevicePlatform;
  appVersion: string;
}

export type DeviceUpdate = Partial<Pick<Device, 'deviceName'>>;
