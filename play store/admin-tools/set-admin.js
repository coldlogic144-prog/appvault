/**
 * Server-Side CLI Tool to grant or verify Administrator privileges for AppVault Store.
 * 
 * Authentication Methods (Automatic Fallback):
 *   Method A: Service Account Key (Production / CI / Standalone)
 *     - Place `serviceAccountKey.json` in this directory (`admin-tools/`).
 *   Method B: Firebase CLI Session (Development / Local Workstation)
 *     - Automatically uses the active `firebase login` session if serviceAccountKey.json is not present.
 * 
 * Usage:
 *   node set-admin.js <user-email-or-uid>
 * 
 * Example:
 *   node set-admin.js coldlogic144@gmail.com
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const targetIdentifier = process.argv[2];
if (!targetIdentifier) {
  console.log('\x1b[33mUsage: node set-admin.js <user-email-or-uid>\x1b[0m');
  console.log('Example: node set-admin.js coldlogic144@gmail.com');
  process.exit(1);
}

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

// Helper to make HTTPS requests
function httpsRequest(urlStr, options, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (data) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch (_) {
          parsed = body;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          const err = new Error(parsed?.error?.message || `HTTP ${res.statusCode}: ${body}`);
          err.statusCode = res.statusCode;
          err.responseBody = parsed;
          reject(err);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Read projectId from google-services.json or firebase.json
function detectProjectId() {
  try {
    const gservicesPath = path.join(__dirname, '..', 'app', 'google-services.json');
    if (fs.existsSync(gservicesPath)) {
      const gs = JSON.parse(fs.readFileSync(gservicesPath, 'utf8'));
      if (gs?.project_info?.project_id) return gs.project_info.project_id;
    }
  } catch (_) {}
  return 'playstore-d0ba0';
}

async function runWithServiceAccount(serviceAccount, identifier) {
  console.log('\x1b[36mAuthenticating via Service Account Key...\x1b[0m');
  const admin = require('firebase-admin');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  let user;
  if (identifier.includes('@')) {
    user = await admin.auth().getUserByEmail(identifier);
  } else {
    user = await admin.auth().getUser(identifier);
  }

  console.log(`Found Firebase user: ${user.email} (UID: ${user.uid})`);

  // 1. Set Custom Claims on Firebase Authentication
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log('\x1b[32m✔ Layer 1: Firebase Auth custom claim `admin: true` granted successfully.\x1b[0m');

  // 2. Set Firestore record in /admins/{uid}
  const db = admin.firestore();
  await db.collection('admins').doc(user.uid).set({
    email: user.email,
    role: 'admin',
    admin: true,
    grantedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'cli-admin-tool'
  }, { merge: true });
  console.log(`\x1b[32m✔ Layer 2: Cloud Firestore record /admins/${user.uid} created successfully.\x1b[0m`);
}

async function runWithFirebaseCLI(identifier) {
  console.log('\x1b[36mAuthenticating via active Firebase CLI session...\x1b[0m');
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('No Firebase CLI session found and no serviceAccountKey.json provided.');
  }

  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  let accessToken = cfg.tokens?.access_token;
  const refreshToken = cfg.tokens?.refresh_token;
  const expiresAt = cfg.tokens?.expires_at || 0;

  // Refresh token if expired
  if (expiresAt && Date.now() > expiresAt - 60000 && refreshToken) {
    console.log('Refreshing Firebase CLI access token...');
    const refreshData = new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho85qd6.apps.googleusercontent.com',
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString();

    const refreshRes = await httpsRequest('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, refreshData);

    accessToken = refreshRes.access_token;
  }

  const projectId = detectProjectId();
  console.log(`Target Firebase Project: \x1b[33m${projectId}\x1b[0m`);

  // 1. Lookup user by email or localId
  const lookupPayload = identifier.includes('@')
    ? JSON.stringify({ email: [identifier] })
    : JSON.stringify({ localId: [identifier] });

  const lookupRes = await httpsRequest(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    },
    lookupPayload
  );

  const user = lookupRes.users?.[0];
  if (!user) {
    throw new Error(`User '${identifier}' not found in Firebase Authentication for project '${projectId}'. Ensure the user has registered in the app first.`);
  }

  console.log(`Found Firebase user: ${user.email} (UID: ${user.localId})`);

  // 2. Set Custom User Claims on Firebase Auth
  const updatePayload = JSON.stringify({
    localId: user.localId,
    customAttributes: JSON.stringify({ admin: true })
  });

  await httpsRequest(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    },
    updatePayload
  );
  console.log('\x1b[32m✔ Layer 1: Firebase Auth custom claim `admin: true` granted successfully.\x1b[0m');

  // 3. Set Firestore record in /admins/{uid}
  const firestoreDocPayload = JSON.stringify({
    fields: {
      email: { stringValue: user.email },
      role: { stringValue: 'admin' },
      admin: { booleanValue: true },
      grantedAt: { timestampValue: new Date().toISOString() },
      updatedBy: { stringValue: 'cli-admin-tool' }
    }
  });

  await httpsRequest(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admins/${user.localId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    },
    firestoreDocPayload
  );
  console.log(`\x1b[32m✔ Layer 2: Cloud Firestore record /admins/${user.localId} created successfully.\x1b[0m`);
}

async function main() {
  try {
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      await runWithServiceAccount(serviceAccount, targetIdentifier);
    } else {
      await runWithFirebaseCLI(targetIdentifier);
    }

    console.log('\n\x1b[32m==================================================\x1b[0m');
    console.log('\x1b[32mSUCCESS: Administrator privileges confirmed!\x1b[0m');
    console.log('\x1b[32m==================================================\x1b[0m');
    console.log('\nNext steps on your Android device:');
    console.log('1. Open AppVault Store.');
    console.log('2. If already logged in, tap Sign Out on the Admin screen.');
    console.log('3. Sign back in with the administrator credentials.');
    console.log('   (Signing in forces Firebase Auth to mint a fresh token containing `admin: true`).');
    console.log('4. The Admin Dashboard will open immediately.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n\x1b[31mError granting admin privileges:\x1b[0m', err.message);
    process.exit(1);
  }
}

main();
