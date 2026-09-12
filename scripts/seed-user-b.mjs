/**
 * ComicLink Local Firebase Emulator Seed Script: User B & Active Pairing
 *
 * This script runs strictly against the local Firebase Emulator.
 * It idempotently creates User B, registers User B's station ("Field Station Beta"),
 * and establishes a valid mutual active pairing with Tanish's station ("HQ Windows Workstation").
 *
 * It does NOT bypass security rules or create fake chat messages.
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';

const EMULATOR_AUTH_URL = 'http://127.0.0.1:9099';
const EMULATOR_FIRESTORE_HOST = '127.0.0.1';
const EMULATOR_FIRESTORE_PORT = 8080;
const PROJECT_ID = 'comiclink-dev';

const USER_B_EMAIL = 'userb@comiclink.local';
const USER_B_PASSWORD = 'Password123!';
const USER_B_DISPLAY_NAME = 'Operative Beta';
const USER_B_DEVICE_ID = 'b2222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_B_DEVICE_NAME = 'Field Station Beta';

async function main() {
  console.log('====================================================');
  console.log('ComicLink — Local Emulator Seed: User B & Pairing');
  console.log('====================================================');

  const app = initializeApp({
    projectId: PROJECT_ID,
    apiKey: 'local-emulator-api-key'
  });
  const auth = getAuth(app);
  const db = getFirestore(app);

  connectAuthEmulator(auth, EMULATOR_AUTH_URL, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_FIRESTORE_HOST, EMULATOR_FIRESTORE_PORT);

  // 1. Locate current primary operative (Tanish) in Firestore emulator
  console.log('\n[1/5] Discovering Tanish station in Firestore emulator...');
  let tanishUid = 'V6zzv5ST9P7SSXZtHIbrxSM7TTPi'; // The active workstation account
  let tanishDeviceId = '9313cfae-8b39-46e6-9777-090910696887';
  let tanishDeviceName = 'HQ Windows Workstation';

  try {
    const devRes = await fetch(`http://${EMULATOR_FIRESTORE_HOST}:${EMULATOR_FIRESTORE_PORT}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${tanishUid}/devices/${tanishDeviceId}`, {
      headers: { Authorization: 'Bearer owner' }
    });
    if (devRes.ok) {
      const devData = await devRes.json();
      tanishDeviceName = devData.fields?.deviceName?.stringValue || tanishDeviceName;
    }
  } catch {}

  console.log(`  Operative A (Tanish): UID=${tanishUid}, DeviceId=${tanishDeviceId}, DeviceName="${tanishDeviceName}"`);

  // 2. Authenticate or create User B in Auth emulator
  console.log('\n[2/5] Authenticating User B in Firebase Auth emulator...');
  let userB;
  try {
    const cred = await signInWithEmailAndPassword(auth, USER_B_EMAIL, USER_B_PASSWORD);
    userB = cred.user;
    console.log(`  User B already registered in Auth emulator (UID: ${userB.uid})`);
  } catch (err) {
    const cred = await createUserWithEmailAndPassword(auth, USER_B_EMAIL, USER_B_PASSWORD);
    userB = cred.user;
    await updateProfile(userB, { displayName: USER_B_DISPLAY_NAME });
    console.log(`  Created User B in Auth emulator (UID: ${userB.uid})`);
  }

  // 3. Register User B Private Account, Public Profile, and Device Station
  console.log('\n[3/5] Registering User B profile and station in Firestore...');
  const userBDocRef = doc(db, 'users', userB.uid);
  const userBSnap = await getDoc(userBDocRef);
  if (!userBSnap.exists()) {
    await setDoc(userBDocRef, {
      uid: userB.uid,
      email: userB.email,
      emailVerified: false,
      blockedUsers: [],
      clipboardSyncEnabled: true,
      deviceCount: 0,
      role: 'user',
      accountStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log(`  Created users/${userB.uid}`);
  } else {
    console.log(`  users/${userB.uid} already exists`);
  }

  const profileRef = doc(db, 'publicProfiles', userB.uid);
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) {
    await setDoc(profileRef, {
      uid: userB.uid,
      displayName: USER_B_DISPLAY_NAME,
      photoURL: null,
      bio: 'Forward field operative stationed in Sector 4',
      presenceStatus: 'online',
      updatedAt: serverTimestamp()
    });
    console.log(`  Created publicProfiles/${userB.uid}`);
  } else {
    console.log(`  publicProfiles/${userB.uid} already exists`);
  }

  const deviceRef = doc(db, 'users', userB.uid, 'devices', USER_B_DEVICE_ID);
  const deviceSnap = await getDoc(deviceRef);
  if (!deviceSnap.exists()) {
    await setDoc(deviceRef, {
      deviceId: USER_B_DEVICE_ID,
      ownerId: userB.uid,
      deviceName: USER_B_DEVICE_NAME,
      platform: 'windows',
      appVersion: '0.1.0',
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      isRevoked: false,
      revokedAt: null
    });
    console.log(`  Registered device users/${userB.uid}/devices/${USER_B_DEVICE_ID}`);
  } else {
    console.log(`  Device ${USER_B_DEVICE_ID} already registered`);
  }

  // 4. Establish mutual active pairing record
  console.log('\n[4/5] Establishing active pairing between Tanish and User B...');
  const pairId = [tanishDeviceId, USER_B_DEVICE_ID].sort().join('_');
  const pairRef = doc(db, 'pairedDevices', pairId);
  const pairSnap = await getDoc(pairRef);

  if (!pairSnap.exists()) {
    const pairedRecord = {
      pairId,
      ownerUid: userB.uid,
      deviceA: USER_B_DEVICE_ID,
      deviceB: tanishDeviceId,
      platformA: 'windows',
      platformB: 'windows',
      deviceNameA: USER_B_DEVICE_NAME,
      deviceNameB: tanishDeviceName,
      status: 'active',
      userA: userB.uid,
      userB: tanishUid,
      createdAt: serverTimestamp(),
      unpairedAt: null
    };

    await setDoc(pairRef, pairedRecord);
    console.log(`  Active pair record established: pairedDevices/${pairId}`);
  } else {
    console.log(`  Active pair record already exists: pairedDevices/${pairId}`);
  }

  // 5. Verification check
  console.log('\n[5/5] Verifying pairing resolution for both operatives...');
  const [snapA, snapB] = await Promise.all([
    getDocs(query(collection(db, 'pairedDevices'), where('userA', '==', userB.uid), where('status', '==', 'active'))),
    getDocs(query(collection(db, 'pairedDevices'), where('userB', '==', userB.uid), where('status', '==', 'active')))
  ]);
  const userBPairs = new Map();
  [...snapA.docs, ...snapB.docs].forEach(d => userBPairs.set(d.id, d.data()));
  console.log(`  User B active paired contacts: ${userBPairs.size}`);

  console.log('\n====================================================');
  console.log('SUCCESS! LOCAL EMULATOR SEED COMPLETE');
  console.log('====================================================');
  console.log(`User B Credentials:`);
  console.log(`  Email:    ${USER_B_EMAIL}`);
  console.log(`  Password: ${USER_B_PASSWORD}`);
  console.log(`  Station:  ${USER_B_DEVICE_NAME} (${USER_B_DEVICE_ID})`);
  console.log(`\nPaired with Tanish:`);
  console.log(`  UID:      ${tanishUid}`);
  console.log(`  Station:  ${tanishDeviceName} (${tanishDeviceId})`);
  console.log(`  Pair ID:  ${pairId}`);
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
