# GitHub Releases APK Distribution Guide for AppVault Store

This document describes the workflow for publishing and distributing Android application APKs via **GitHub Releases** instead of Firebase Storage in the AppVault Store.

---

## Architecture Overview

```text
Android App (AppVault)
├── Firebase Authentication       (Admin authorization)
├── Cloud Firestore
│   ├── App metadata             (Name, category, developer, icon, screenshots)
│   ├── Version metadata         (versionName, versionCode, releaseTag, releaseNotes)
│   ├── Published status         (true / false)
│   └── APK GitHub Release URL   (Direct HTTPS asset link)
└── GitHub Releases
    └── APK files                (Hosted freely on GitHub Releases infrastructure)
```

No GitHub personal access tokens or private API keys are needed inside the Android app. GitHub Releases assets are publicly accessible direct binary downloads.

---

## Publishing Workflow

Follow this step-by-step procedure whenever publishing a new app version or update:

### Step 1: Build APK in Android Studio
1. Open your app project in Android Studio.
2. Navigate to **Build** > **Generate Signed Bundle / APK...** or select **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3. Locate the generated output APK (e.g. `app-release.apk`).

### Step 2: Create GitHub Release
1. Navigate to your app's GitHub repository in your web browser:
   `https://github.com/OWNER/REPO`
2. In the right sidebar, click on **Releases** > **Draft a new release**.

### Step 3: Add Release Tag
1. Click **Choose a tag**.
2. Enter a version tag matching your release version (e.g. `v1.1.0` or `v2.0.0`).
3. Set the target branch (usually `main` or `master`).
4. Enter a release title (e.g., `Release v1.1.0`).

### Step 4: Upload APK as Release Asset
1. In the **Attach binaries by dropping them here or selecting them** area, drag and drop your compiled APK file (e.g., `app-release.apk`).
2. Write any release notes or changelog in the release description box.
3. Click **Publish release**.

### Step 5: Copy APK Release URL
1. Once published, locate the uploaded `.apk` file under **Assets**.
2. Right-click the `.apk` asset link and select **Copy Link Address**.
3. Verify the URL format matches:
   ```text
   https://github.com/OWNER/REPO/releases/download/TAG/FILE.apk
   ```
   **Example**:
   ```text
   https://github.com/acme/notes-app/releases/download/v1.1.0/notes-app-release.apk
   ```

### Step 6: Open AppVault Admin
1. Open the AppVault Store app on your device.
2. Go to **Settings** > **Admin Panel**.
3. Authenticate with your administrator credentials.
4. Select the target application from the admin catalogue.

### Step 7: Create a New Version
1. Tap on **Manage Versions** > **Publish New Version** (or the **+** FAB button).

### Step 8: Enter Version Information
1. **Version Name**: e.g., `1.1.0`
2. **Version Code**: A positive numeric integer greater than existing versions (e.g., `2`).
3. **Release Tag**: e.g., `v1.1.0`
4. **Release Notes**: Outline bug fixes, new features, and improvements.
5. **Minimum Android SDK**: Android API level (e.g., `26` for Android 8.0+).

### Step 9: Paste APK URL
1. Paste the copied GitHub Release APK URL into the **APK Download URL** field:
   ```text
   https://github.com/OWNER/REPO/releases/download/v1.1.0/app-release.apk
   ```

### Step 10: Publish the Version
1. Ensure the **Publish Immediately** switch is enabled (or leave disabled as draft if preparing ahead).
2. Tap **Publish Version**.
3. Firestore atomically stores the new version document and updates the parent app's `latestVersionCode` and `latestVersionName`.

### Step 11: Users Download / Update Through AppVault
1. Users open the app in AppVault Store.
2. If the user has an older version installed, AppVault presents an **UPDATE** button.
3. If not installed, AppVault presents an **INSTALL** button.
4. AppVault streams the APK directly from GitHub Releases into the application cache and triggers Android's official package installer.
5. Users continue using their apps without forced interruptions.

---

## Expected APK URL Format Reference

| Component | Format | Example |
| :--- | :--- | :--- |
| **Host** | `https://github.com` | `https://github.com` |
| **Owner** | Repository owner / organization | `mmmut` |
| **Repository** | Repository name | `campus-app` |
| **Releases Path**| `/releases/download/` | `/releases/download/` |
| **Tag** | Release tag identifier | `v1.0.0` |
| **Asset File** | Binary filename ending in `.apk` | `app-release.apk` |

**Full URL Template**:
```text
https://github.com/{OWNER}/{REPO}/releases/download/{TAG}/{FILE}.apk
```

---

## Error Handling & Troubleshooting

- **"Invalid APK download URL."**: Verify that the URL begins with `https://github.com/` and ends with `.apk`.
- **"APK link is unavailable."**: Verify the GitHub repository is public or the release asset has finished processing. If private, GitHub asset downloads require authenticated sessions.
- **"Unable to download APK. Check your internet connection."**: Ensure your Android device has an active Wi-Fi or mobile data connection.
- **"Download completed, but Android could not start the installer."**: Ensure AppVault is granted permission to install unknown apps under Android device settings (**Install unknown apps** > **AppVault** > **Allow**).
