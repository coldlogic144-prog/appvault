import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { Device } from '@comiclink/shared-types';
import { ERROR_CODES, createAppError } from '@comiclink/error-codes';

const LOCAL_DEVICE_ID_KEY = 'comiclink_device_id';
const LOCAL_DEVICE_NAME_KEY = 'comiclink_device_name';

/**
 * Retrieves the local device UUID or generates a cryptographically random UUID v4.
 * Stored securely in localStorage so identity remains stable across app restarts.
 */
export function getLocalDeviceId(): string {
  let deviceId = localStorage.getItem(LOCAL_DEVICE_ID_KEY);
  if (!deviceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(LOCAL_DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function getLocalDeviceName(): string {
  const savedName = localStorage.getItem(LOCAL_DEVICE_NAME_KEY);
  if (savedName && savedName.trim().length > 0) {
    return savedName.trim();
  }
  return 'HQ Windows Workstation';
}

export function setLocalDeviceName(name: string): void {
  localStorage.setItem(LOCAL_DEVICE_NAME_KEY, name.trim());
}

/**
 * Idempotently registers or updates the current Windows installation in Firestore.
 * If already registered and not revoked, updates lastSeenAt heartbeat.
 */
export async function registerCurrentDevice(ownerId: string): Promise<Device> {
  if (!db) {
    throw createAppError(ERROR_CODES.AUTH.CONFIGURATION_ERROR, 'Firestore database is not configured.');
  }

  const deviceId = getLocalDeviceId();
  const deviceRef = doc(db, 'users', ownerId, 'devices', deviceId);

  try {
    const snap = await getDoc(deviceRef);
    if (!snap.exists()) {
      const newDevice: Device = {
        deviceId,
        ownerId,
        deviceName: getLocalDeviceName(),
        platform: 'windows',
        appVersion: '0.1.0',
        createdAt: serverTimestamp() as any,
        lastSeenAt: serverTimestamp() as any,
        isRevoked: false,
        revokedAt: null
      };
      await setDoc(deviceRef, newDevice);
      return newDevice;
    }

    const currentData = snap.data() as Device;
    if (!currentData.isRevoked) {
      await updateDoc(deviceRef, {
        lastSeenAt: serverTimestamp()
      });
    }

    return currentData;
  } catch (error: any) {
    console.warn('[DeviceService] Offline or failed to sync device registration:', error);
    // Return local representation so UI remains functional even during transient offline state
    return {
      deviceId,
      ownerId,
      deviceName: getLocalDeviceName(),
      platform: 'windows',
      appVersion: '0.1.0',
      createdAt: new Date() as any,
      lastSeenAt: new Date() as any,
      isRevoked: false,
      revokedAt: null
    };
  }
}

/**
 * Fetches all registered client devices for the authenticated user.
 */
export async function getUserDevices(ownerId: string): Promise<Device[]> {
  if (!db) return [];

  try {
    const devicesCol = collection(db, 'users', ownerId, 'devices');
    const snap = await getDocs(devicesCol);
    const devices: Device[] = [];
    snap.forEach((d) => {
      devices.push(d.data() as Device);
    });
    // Sort active first, then most recently seen
    return devices.sort((a, b) => {
      if (a.isRevoked !== b.isRevoked) return a.isRevoked ? 1 : -1;
      const timeA = a.lastSeenAt?.seconds || 0;
      const timeB = b.lastSeenAt?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error: any) {
    console.error('[DeviceService] Error fetching user devices:', error);
    throw createAppError(ERROR_CODES.DEVICE.NOT_FOUND, 'Could not retrieve device fleet.');
  }
}

/**
 * Revokes authorization for a device. Soft-deletes station access.
 */
export async function revokeDevice(ownerId: string, deviceId: string): Promise<void> {
  if (!db) return;

  try {
    const deviceRef = doc(db, 'users', ownerId, 'devices', deviceId);
    await updateDoc(deviceRef, {
      isRevoked: true,
      revokedAt: serverTimestamp()
    });
  } catch (error: any) {
    throw createAppError(ERROR_CODES.DEVICE.ALREADY_REVOKED, 'Failed to revoke device authorization.');
  }
}

/**
 * Renames a device station.
 */
export async function updateDeviceCallsign(ownerId: string, deviceId: string, newName: string): Promise<void> {
  if (!db) return;

  const trimmed = newName.trim();
  if (!trimmed || trimmed.length > 100) {
    throw createAppError(ERROR_CODES.GENERAL.INVALID_INPUT, 'Device name must be between 1 and 100 characters.');
  }

  const deviceRef = doc(db, 'users', ownerId, 'devices', deviceId);
  await updateDoc(deviceRef, {
    deviceName: trimmed,
    lastSeenAt: serverTimestamp()
  });

  if (deviceId === getLocalDeviceId()) {
    setLocalDeviceName(trimmed);
  }
}
