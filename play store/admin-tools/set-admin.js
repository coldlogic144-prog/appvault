/**
 * CLI Tool to grant Administrator privileges to a Firebase user.
 * 
 * Usage:
 *   1. Download your Firebase service account private key from:
 *      Firebase Console -> Project Settings -> Service Accounts -> Generate new private key
 *   2. Save the file as `serviceAccountKey.json` inside this folder (`admin-tools/`).
 *   3. Run:
 *      npm install
 *      node set-admin.js <user-email-or-uid>
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('\x1b[31mError: serviceAccountKey.json not found in admin-tools directory!\x1b[0m');
  console.error('Please download your Service Account Key from Firebase Console and place it at:');
  console.error(serviceAccountPath);
  process.exit(1);
}

const targetIdentifier = process.argv[2];
if (!targetIdentifier) {
  console.error('\x1b[33mUsage: node set-admin.js <user-email-or-uid>\x1b[0m');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function makeAdmin(identifier) {
  try {
    let user;
    if (identifier.includes('@')) {
      user = await admin.auth().getUserByEmail(identifier);
    } else {
      user = await admin.auth().getUser(identifier);
    }

    console.log(`Found user: ${user.email} (UID: ${user.uid})`);

    // 1. Set Custom Claims on Firebase Authentication
    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true
    });
    console.log('\x1b[32m✔ Firebase Auth custom claim `admin: true` granted successfully.\x1b[0m');

    // 2. Also record in Firestore /admins/{uid} collection for double-layer security rules
    const db = admin.firestore();
    await db.collection('admins').doc(user.uid).set({
      email: user.email,
      role: 'admin',
      grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'cli-admin-tool'
    }, { merge: true });
    console.log('\x1b[32m✔ Document /admins/' + user.uid + ' updated in Firestore.\x1b[0m');

    console.log('\n\x1b[36mSuccess! User can now sign into AppVault Admin Panel.\x1b[0m');
    console.log('Note: If the user was already signed in on an Android device, they must sign out and sign in again to refresh their ID token claims.');
    process.exit(0);
  } catch (error) {
    console.error('\x1b[31mFailed to grant admin privileges:\x1b[0m', error.message);
    process.exit(1);
  }
}

makeAdmin(targetIdentifier);
