# AppVault Store - Admin Tools

This directory contains utility scripts for administrative management of the AppVault custom store.

## How to Grant Administrator Privileges

Security Requirement:
> There is NO default admin access. Regular users and unauthenticated users cannot access administrative endpoints or Firestore write rules.

To grant administrator access to a user account:

1. **Create or have a Firebase account**:
   Register a user with an email and password in your Firebase Authentication console (or via your app).

2. **Download Firebase Service Account Key**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Open **Project Settings** (gear icon) -> **Service Accounts** tab
   - Click **Generate new private key**
   - Save the downloaded JSON file as `serviceAccountKey.json` inside this `admin-tools/` directory.

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run the Promotion Script**:
   ```bash
   node set-admin.js your-admin-email@example.com
   ```
   or with UID:
   ```bash
   node set-admin.js <firebase-user-uid>
   ```

This will:
- Set Firebase Auth custom user claims: `{ admin: true }`
- Create/update `/admins/{uid}` document in Cloud Firestore

5. **Sign into the App**:
   Open AppVault on your device -> **Settings** -> **Admin Sign In** -> Enter credentials -> Access Admin Dashboard!
